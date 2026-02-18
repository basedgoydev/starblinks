import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import { getTokenState, TokenState } from "./token-state";
import { buildPumpBuyInstructions } from "./pump";
import { getPumpSwapTransaction } from "./pumpswap";
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

  // Calculate fees
  const feeBreakdown = calculateFees(solAmountLamports, referrer !== null);

  // Build swap instructions based on token state
  if (!tokenState.isGraduated && tokenState.bondingCurve) {
    // Token is on bonding curve - use Pump.fun SDK
    // FEES DISABLED for Dialect approval - re-enable later
    const pumpInstructions = await buildPumpBuyInstructions({
      connection,
      mint,
      buyer,
      solAmountLamports: solAmountLamports, // Full amount, no fees
      tokenState,
    });

    // Build legacy transaction
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: buyer,
      blockhash,
      lastValidBlockHeight,
    });

    // FEES DISABLED - just add swap
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
    // Token is graduated - use pumpportal.fun API (no fees for now)
    // The API handles everything including pool detection
    const swapTx = await getPumpSwapTransaction(
      buyer.toBase58(),
      mint.toBase58(),
      solAmountLamports,
      100 // 1% slippage
    );

    const serialized = Buffer.from(swapTx.serialize()).toString("base64");

    return {
      transaction: serialized,
      isVersioned: true,
      tokenState,
      feeBreakdown,
    };
  }
}
