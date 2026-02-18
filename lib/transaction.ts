import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { getConnection } from "./connection";
import { getTokenState, TokenState } from "./token-state";
import { buildPumpBuyInstructions } from "./pump";
import { buildJupiterSwapInstructions } from "./jupiter";
import { calculateFees, buildFeeInstructions, FeeBreakdown } from "./fees";
import { PLATFORM_WALLET, TOTAL_FEE_BPS } from "./constants";

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
    // Token is on bonding curve - use Pump.fun SDK (fees disabled for now)
    const pumpInstructions = await buildPumpBuyInstructions({
      connection,
      mint,
      buyer,
      solAmountLamports,
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

    // Add swap instructions (no fees)
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
    // Token is graduated - use Jupiter with platform fee (fee in output tokens)
    const {
      instructions: jupiterInstructions,
      addressLookupTableAccounts,
    } = await buildJupiterSwapInstructions(
      connection,
      mint,
      buyer,
      solAmountLamports,
      TOTAL_FEE_BPS, // Platform fee in bps (taken from output tokens)
      PLATFORM_WALLET
    );

    const { blockhash } = await connection.getLatestBlockhash();

    if (addressLookupTableAccounts.length > 0) {
      // Build versioned transaction with ALTs
      const message = new TransactionMessage({
        payerKey: buyer,
        recentBlockhash: blockhash,
        instructions: jupiterInstructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const versionedTx = new VersionedTransaction(message);
      const serialized = Buffer.from(versionedTx.serialize()).toString("base64");

      return {
        transaction: serialized,
        isVersioned: true,
        tokenState,
        feeBreakdown,
      };
    } else {
      // Build legacy transaction
      const tx = new Transaction({
        feePayer: buyer,
        blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      });

      tx.add(...jupiterInstructions);

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
}
