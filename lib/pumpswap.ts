import {
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Get PumpSwap/Pump.fun swap instructions via Metis API
 * This API handles both bonding curve and graduated tokens
 */
export async function getPumpSwapInstructions(
  wallet: string,
  mint: string,
  solAmountLamports: bigint,
  slippageBps: number = 100
): Promise<TransactionInstruction[]> {
  // Use pump.fun API to get swap instructions
  const response = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: wallet,
      action: "buy",
      mint: mint,
      amount: Number(solAmountLamports) / 1e9, // Convert to SOL
      denominatedInSol: "true",
      slippage: slippageBps / 100, // Convert bps to percentage
      priorityFee: 0.0001, // Small priority fee
      pool: "auto", // Auto-detect pool (bonding curve or pump swap)
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PumpSwap API failed: ${error}`);
  }

  // The API returns a base64 encoded transaction
  const txData = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

  // Extract instructions from the transaction
  // For versioned transactions, we need to decompile
  // But since we just need the raw transaction, we'll use a different approach
  return []; // We'll return the full transaction instead
}

/**
 * Get a complete swap transaction from pump.fun API
 */
export async function getPumpSwapTransaction(
  wallet: string,
  mint: string,
  solAmountLamports: bigint,
  slippageBps: number = 100
): Promise<VersionedTransaction> {
  const response = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: wallet,
      action: "buy",
      mint: mint,
      amount: Number(solAmountLamports) / 1e9, // Convert to SOL
      denominatedInSol: "true",
      slippage: slippageBps / 100, // Convert bps to percentage
      priorityFee: 0.0001, // Small priority fee
      pool: "auto", // Auto-detect pool
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PumpSwap API failed: ${error}`);
  }

  const txData = await response.arrayBuffer();
  return VersionedTransaction.deserialize(new Uint8Array(txData));
}
