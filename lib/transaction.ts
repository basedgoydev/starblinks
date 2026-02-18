import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
} from "@solana/spl-token";
import { getConnection } from "./connection";
import { getTokenState, TokenState } from "./token-state";
import { buildPumpBuyInstructions } from "./pump";
import {
  findPumpSwapPool,
  buildPumpSwapBuyInstructions,
  getPoolReserves,
  calculatePumpSwapOutput,
} from "./pumpswap";
import { calculateFees, buildFeeInstructions, FeeBreakdown } from "./fees";

interface BuildTransactionParams {
  mint: PublicKey;
  buyer: PublicKey;
  solAmountLamports: bigint;
  referrer: PublicKey | null;
}

interface BuildTransactionResult {
  transaction: string; // Base64 encoded
  isVersioned: boolean;
  tokenState: TokenState;
  feeBreakdown: FeeBreakdown;
}

export async function buildBuyTransaction({
  mint,
  buyer,
  solAmountLamports,
  referrer,
}: BuildTransactionParams): Promise<BuildTransactionResult> {
  const connection = getConnection();

  // Get token state to determine routing
  const tokenState = await getTokenState(connection, mint);

  // Calculate fees - only apply for amounts >= 0.1 SOL to ensure small trades work
  const MIN_AMOUNT_FOR_FEES = BigInt(100_000_000); // 0.1 SOL in lamports
  const applyFees = solAmountLamports >= MIN_AMOUNT_FOR_FEES;

  const feeBreakdown = calculateFees(solAmountLamports, referrer !== null);

  const feeInstructions = applyFees
    ? buildFeeInstructions(buyer, referrer, feeBreakdown)
    : [];

  const netAmountLamports = applyFees
    ? feeBreakdown.netAmountLamports
    : solAmountLamports;

  // Build swap instructions based on token state
  if (!tokenState.isGraduated && tokenState.bondingCurve) {
    // Token is on bonding curve - use Pump.fun SDK
    const pumpInstructions = await buildPumpBuyInstructions({
      connection,
      mint,
      buyer,
      solAmountLamports: netAmountLamports,
      tokenState,
    });

    // Build legacy transaction (Pump.fun doesn't need versioned TX)
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: buyer,
      blockhash,
      lastValidBlockHeight,
    });

    // Add fee instructions first, then swap
    tx.add(...feeInstructions);
    tx.add(...pumpInstructions);

    const serialized = tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");

    return {
      transaction: serialized,
      isVersioned: false,
      tokenState,
      feeBreakdown,
    };
  } else {
    // Token is graduated - use PumpSwap
    const pool = await findPumpSwapPool(connection, mint);
    if (!pool) {
      throw new Error("Token pool not found on PumpSwap");
    }

    // Get pool reserves for output calculation
    const { solReserve, tokenReserve } = await getPoolReserves(connection, pool);

    // Calculate minimum tokens out with 1% slippage
    const expectedTokens = calculatePumpSwapOutput(netAmountLamports, solReserve, tokenReserve);
    const minTokensOut = (expectedTokens * BigInt(99)) / BigInt(100); // 1% slippage

    // Build wrap SOL instructions
    const wrapInstructions = [];
    const buyerWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, buyer, false);

    // Check if WSOL ATA exists
    const buyerWsolAtaInfo = await connection.getAccountInfo(buyerWsolAta);
    if (!buyerWsolAtaInfo) {
      wrapInstructions.push(
        createAssociatedTokenAccountInstruction(buyer, buyerWsolAta, buyer, NATIVE_MINT)
      );
    }

    // Transfer SOL to WSOL ATA and sync
    wrapInstructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: buyerWsolAta,
        lamports: netAmountLamports,
      }),
      createSyncNativeInstruction(buyerWsolAta)
    );

    // Build PumpSwap buy instructions
    const pumpSwapInstructions = await buildPumpSwapBuyInstructions({
      connection,
      pool,
      buyer,
      solAmountLamports: netAmountLamports,
      minTokensOut,
    });

    // Build legacy transaction
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: buyer,
      blockhash,
      lastValidBlockHeight,
    });

    // Order: 1) fees, 2) wrap SOL, 3) PumpSwap
    tx.add(...feeInstructions);
    tx.add(...wrapInstructions);
    tx.add(...pumpSwapInstructions);

    const serialized = tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");

    return {
      transaction: serialized,
      isVersioned: false,
      tokenState,
      feeBreakdown,
    };
  }
}
