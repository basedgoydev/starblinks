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

  // Calculate fees (temporarily disabled for testing)
  const feeBreakdown = calculateFees(solAmountLamports, referrer !== null);

  // TEMPORARILY DISABLED: Build fee transfer instructions
  // const feeInstructions = buildFeeInstructions(buyer, referrer, feeBreakdown);
  const feeInstructions: any[] = []; // Empty - no fees for now

  // Use full amount for swap (fees disabled)
  const netAmountLamports = solAmountLamports;

  let addressLookupTableAccounts: AddressLookupTableAccount[] = [];

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
    // Token is graduated - use Jupiter API
    const { instructions: jupiterInstructions, addressLookupTableAccounts: alts } =
      await buildJupiterSwapInstructions(
        connection,
        mint,
        buyer,
        netAmountLamports
      );

    addressLookupTableAccounts = alts;

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    // Combine fee instructions with Jupiter instructions
    const allInstructions = [...feeInstructions, ...jupiterInstructions];

    if (addressLookupTableAccounts.length > 0) {
      // Build versioned transaction with ALTs
      const message = new TransactionMessage({
        payerKey: buyer,
        recentBlockhash: blockhash,
        instructions: allInstructions,
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
        lastValidBlockHeight,
      });

      tx.add(...allInstructions);

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
