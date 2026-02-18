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

  // Fees only apply to bonding curve tokens (not graduated/Jupiter)
  // Jupiter's wrapAndUnwrapSol conflicts with separate SOL transfers
  const applyFees = !tokenState.isGraduated && tokenState.bondingCurve;

  const feeBreakdown = calculateFees(solAmountLamports, referrer !== null);

  // Only build fee instructions for bonding curve tokens
  const feeInstructions = applyFees
    ? buildFeeInstructions(buyer, referrer, feeBreakdown)
    : [];

  // Net amount: deduct fees only for bonding curve tokens
  const netAmountLamports = applyFees
    ? feeBreakdown.netAmountLamports
    : solAmountLamports;

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
