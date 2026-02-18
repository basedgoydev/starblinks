import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PUMPSWAP_PROGRAM_ID, WSOL_MINT } from "./constants";

// PumpSwap buy instruction discriminator
const BUY_DISCRIMINATOR = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);

// PumpSwap global config
const PUMPSWAP_GLOBAL_CONFIG = new PublicKey("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw");

// PumpSwap fee recipient
const PUMPSWAP_FEE_RECIPIENT = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");

// PumpSwap protocol fee recipient
const PUMPSWAP_PROTOCOL_FEE_RECIPIENT = new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV");

interface PumpSwapPool {
  address: PublicKey;
  baseMint: PublicKey; // Token mint
  quoteMint: PublicKey; // WSOL
  baseVault: PublicKey;
  quoteVault: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
}

/**
 * Find the PumpSwap pool for a graduated token
 */
export async function findPumpSwapPool(
  connection: Connection,
  tokenMint: PublicKey
): Promise<PumpSwapPool | null> {
  // Derive pool address - PumpSwap uses deterministic pool addresses
  // Pool PDA: seeds = ["pool", base_mint, quote_mint]
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), tokenMint.toBuffer(), WSOL_MINT.toBuffer()],
    PUMPSWAP_PROGRAM_ID
  );

  // Try to fetch pool account
  const poolAccount = await connection.getAccountInfo(poolAddress);
  if (!poolAccount) {
    // Try reverse order (WSOL, token)
    const [poolAddressReverse] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), WSOL_MINT.toBuffer(), tokenMint.toBuffer()],
      PUMPSWAP_PROGRAM_ID
    );

    const poolAccountReverse = await connection.getAccountInfo(poolAddressReverse);
    if (!poolAccountReverse) {
      return null;
    }

    return parsePoolAccount(poolAddressReverse, poolAccountReverse.data, true);
  }

  return parsePoolAccount(poolAddress, poolAccount.data, false);
}

function parsePoolAccount(
  address: PublicKey,
  data: Buffer,
  isReversed: boolean
): PumpSwapPool {
  // PumpSwap pool account layout (simplified):
  // - 8 bytes: discriminator
  // - 32 bytes: base_mint
  // - 32 bytes: quote_mint
  // - 32 bytes: base_vault
  // - 32 bytes: quote_vault
  // ... other fields

  const baseMint = new PublicKey(data.slice(8, 40));
  const quoteMint = new PublicKey(data.slice(40, 72));

  // Derive vault addresses
  const [baseVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), address.toBuffer(), baseMint.toBuffer()],
    PUMPSWAP_PROGRAM_ID
  );

  const [quoteVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), address.toBuffer(), quoteMint.toBuffer()],
    PUMPSWAP_PROGRAM_ID
  );

  return {
    address,
    baseMint: isReversed ? quoteMint : baseMint,
    quoteMint: isReversed ? baseMint : quoteMint,
    baseVault: isReversed ? quoteVault : baseVault,
    quoteVault: isReversed ? baseVault : quoteVault,
    baseReserve: BigInt(0), // Will be fetched separately if needed
    quoteReserve: BigInt(0),
  };
}

interface BuildPumpSwapBuyParams {
  connection: Connection;
  pool: PumpSwapPool;
  buyer: PublicKey;
  solAmountLamports: bigint;
  minTokensOut: bigint;
}

/**
 * Build PumpSwap buy instructions (SOL -> Token)
 */
export async function buildPumpSwapBuyInstructions({
  connection,
  pool,
  buyer,
  solAmountLamports,
  minTokensOut,
}: BuildPumpSwapBuyParams): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];

  // Get buyer's token ATA
  const buyerTokenAta = getAssociatedTokenAddressSync(pool.baseMint, buyer, false);

  // Check if buyer's token ATA exists
  const buyerTokenAtaInfo = await connection.getAccountInfo(buyerTokenAta);
  if (!buyerTokenAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        buyer,
        buyerTokenAta,
        buyer,
        pool.baseMint
      )
    );
  }

  // Get buyer's WSOL ATA (for wrapping SOL)
  const buyerWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, buyer, false);

  // Check if WSOL ATA exists
  const buyerWsolAtaInfo = await connection.getAccountInfo(buyerWsolAta);
  if (!buyerWsolAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        buyer,
        buyerWsolAta,
        buyer,
        WSOL_MINT
      )
    );
  }

  // Build the swap instruction
  // PumpSwap buy: swap quote (WSOL) for base (token)
  const swapIx = buildSwapInstruction({
    pool,
    buyer,
    buyerTokenAta,
    buyerWsolAta,
    amountIn: solAmountLamports,
    minAmountOut: minTokensOut,
    isBuy: true,
  });

  instructions.push(swapIx);

  return instructions;
}

interface BuildSwapInstructionParams {
  pool: PumpSwapPool;
  buyer: PublicKey;
  buyerTokenAta: PublicKey;
  buyerWsolAta: PublicKey;
  amountIn: bigint;
  minAmountOut: bigint;
  isBuy: boolean;
}

function buildSwapInstruction({
  pool,
  buyer,
  buyerTokenAta,
  buyerWsolAta,
  amountIn,
  minAmountOut,
  isBuy,
}: BuildSwapInstructionParams): TransactionInstruction {
  // Instruction data: discriminator + amount_in (u64) + min_amount_out (u64)
  const data = Buffer.alloc(24);
  data.set(BUY_DISCRIMINATOR, 0);
  data.writeBigUInt64LE(amountIn, 8);
  data.writeBigUInt64LE(minAmountOut, 16);

  // For buy: user sends WSOL (quote), receives token (base)
  const userSourceAta = isBuy ? buyerWsolAta : buyerTokenAta;
  const userDestAta = isBuy ? buyerTokenAta : buyerWsolAta;
  const poolSourceVault = isBuy ? pool.quoteVault : pool.baseVault;
  const poolDestVault = isBuy ? pool.baseVault : pool.quoteVault;

  const keys = [
    { pubkey: PUMPSWAP_GLOBAL_CONFIG, isSigner: false, isWritable: false },
    { pubkey: PUMPSWAP_FEE_RECIPIENT, isSigner: false, isWritable: true },
    { pubkey: pool.address, isSigner: false, isWritable: true },
    { pubkey: userSourceAta, isSigner: false, isWritable: true },
    { pubkey: userDestAta, isSigner: false, isWritable: true },
    { pubkey: poolSourceVault, isSigner: false, isWritable: true },
    { pubkey: poolDestVault, isSigner: false, isWritable: true },
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: isBuy ? pool.quoteMint : pool.baseMint, isSigner: false, isWritable: false },
    { pubkey: isBuy ? pool.baseMint : pool.quoteMint, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: PUMPSWAP_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: PUMPSWAP_PROGRAM_ID,
    data,
  });
}

/**
 * Calculate expected token output for a given SOL input
 * Uses constant product formula: x * y = k
 */
export function calculatePumpSwapOutput(
  solAmountLamports: bigint,
  solReserve: bigint,
  tokenReserve: bigint,
  feeBps: number = 25 // PumpSwap fee is 0.25%
): bigint {
  // Deduct fee from input
  const amountInAfterFee = (solAmountLamports * BigInt(10000 - feeBps)) / BigInt(10000);

  // Constant product: (x + dx) * (y - dy) = x * y
  // dy = y * dx / (x + dx)
  const numerator = tokenReserve * amountInAfterFee;
  const denominator = solReserve + amountInAfterFee;

  return numerator / denominator;
}

/**
 * Get pool reserves
 */
export async function getPoolReserves(
  connection: Connection,
  pool: PumpSwapPool
): Promise<{ solReserve: bigint; tokenReserve: bigint }> {
  // Fetch vault token accounts
  const [baseVaultInfo, quoteVaultInfo] = await Promise.all([
    connection.getTokenAccountBalance(pool.baseVault),
    connection.getTokenAccountBalance(pool.quoteVault),
  ]);

  return {
    tokenReserve: BigInt(baseVaultInfo.value.amount),
    solReserve: BigInt(quoteVaultInfo.value.amount),
  };
}
