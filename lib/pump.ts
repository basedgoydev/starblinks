import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PUMP_PROGRAM_ID,
  PUMP_GLOBAL_STATE,
  PUMP_FEE_RECIPIENT,
  PUMP_FEE_RECIPIENT_MAYHEM,
} from "./constants";
import { deriveBondingCurvePDA, TokenState } from "./token-state";

// Buy instruction discriminator: SHA256("global:buy")[0..8]
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

// Event authority PDA
const [EVENT_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from("__event_authority")],
  PUMP_PROGRAM_ID
);

interface BuildPumpBuyParams {
  connection: Connection;
  mint: PublicKey;
  buyer: PublicKey;
  solAmountLamports: bigint;
  tokenState: TokenState;
  slippageBps?: number;
}

export async function buildPumpBuyInstructions({
  connection,
  mint,
  buyer,
  solAmountLamports,
  tokenState,
  slippageBps = 500, // 5% default slippage
}: BuildPumpBuyParams): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];

  if (!tokenState.bondingCurve) {
    throw new Error("Token is not on bonding curve");
  }

  const bondingCurve = tokenState.bondingCurve;

  // Derive associated token accounts
  const associatedBondingCurve = getAssociatedTokenAddressSync(
    mint,
    bondingCurve,
    true // allowOwnerOffCurve
  );

  const associatedUser = getAssociatedTokenAddressSync(mint, buyer, false);

  // Check if user's ATA exists
  const userAtaInfo = await connection.getAccountInfo(associatedUser);
  if (!userAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        buyer, // payer
        associatedUser, // ata
        buyer, // owner
        mint // mint
      )
    );
  }

  // Calculate expected token output with slippage
  const tokenAmount = calculateTokenOutput(
    solAmountLamports,
    tokenState.virtualSolReserves!,
    tokenState.virtualTokenReserves!
  );

  // Apply slippage tolerance (minimum tokens we accept)
  const minTokenAmount =
    (tokenAmount * BigInt(10000 - slippageBps)) / BigInt(10000);

  // Select fee recipient based on mayhem mode
  const feeRecipient = tokenState.isMayhemMode
    ? PUMP_FEE_RECIPIENT_MAYHEM
    : PUMP_FEE_RECIPIENT;

  // Build the buy instruction
  const buyIx = buildBuyInstruction({
    mint,
    bondingCurve,
    associatedBondingCurve,
    associatedUser,
    buyer,
    feeRecipient,
    tokenAmount: minTokenAmount,
    maxSolCost: solAmountLamports,
  });

  instructions.push(buyIx);

  return instructions;
}

function calculateTokenOutput(
  solAmountLamports: bigint,
  virtualSolReserves: bigint,
  virtualTokenReserves: bigint
): bigint {
  // AMM formula: tokenOut = (solIn * virtualTokenReserves) / (virtualSolReserves + solIn)
  const numerator = solAmountLamports * virtualTokenReserves;
  const denominator = virtualSolReserves + solAmountLamports;
  return numerator / denominator;
}

interface BuildBuyInstructionParams {
  mint: PublicKey;
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  associatedUser: PublicKey;
  buyer: PublicKey;
  feeRecipient: PublicKey;
  tokenAmount: bigint;
  maxSolCost: bigint;
}

function buildBuyInstruction({
  mint,
  bondingCurve,
  associatedBondingCurve,
  associatedUser,
  buyer,
  feeRecipient,
  tokenAmount,
  maxSolCost,
}: BuildBuyInstructionParams): TransactionInstruction {
  // Encode instruction data
  // discriminator(8) + amount u64 LE(8) + maxSolCost u64 LE(8) = 24 bytes
  const data = Buffer.alloc(24);
  data.set(BUY_DISCRIMINATOR, 0);
  data.writeBigUInt64LE(tokenAmount, 8);
  data.writeBigUInt64LE(maxSolCost, 16);

  // Account order is critical - must match IDL exactly
  const keys = [
    { pubkey: PUMP_GLOBAL_STATE, isSigner: false, isWritable: false }, // 0: global
    { pubkey: feeRecipient, isSigner: false, isWritable: true }, // 1: feeRecipient
    { pubkey: mint, isSigner: false, isWritable: false }, // 2: mint
    { pubkey: bondingCurve, isSigner: false, isWritable: true }, // 3: bondingCurve
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true }, // 4: associatedBondingCurve
    { pubkey: associatedUser, isSigner: false, isWritable: true }, // 5: associatedUser
    { pubkey: buyer, isSigner: true, isWritable: true }, // 6: user
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7: systemProgram
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 8: tokenProgram
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // 9: rent
    { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false }, // 10: eventAuthority
    { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false }, // 11: program
  ];

  return new TransactionInstruction({
    keys,
    programId: PUMP_PROGRAM_ID,
    data,
  });
}

