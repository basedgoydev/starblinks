import {
  Connection,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { WSOL_MINT } from "./constants";

const JUPITER_QUOTE_API = "https://api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_INSTRUCTIONS_API = "https://api.jup.ag/swap/v1/swap-instructions";
const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1/swap";

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  contextSlot: number;
  timeTaken: number;
}

interface SwapInstructionsResponse {
  computeBudgetInstructions: SerializedInstruction[];
  setupInstructions: SerializedInstruction[];
  swapInstruction: SerializedInstruction;
  cleanupInstruction?: SerializedInstruction;
  addressLookupTableAddresses: string[];
}

interface SerializedInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

export async function getJupiterQuote(
  outputMint: PublicKey,
  solAmountLamports: bigint,
  slippageBps: number = 100 // 1% default
): Promise<QuoteResponse> {
  const url = new URL(JUPITER_QUOTE_API);
  url.searchParams.set("inputMint", WSOL_MINT.toBase58());
  url.searchParams.set("outputMint", outputMint.toBase58());
  url.searchParams.set("amount", solAmountLamports.toString());
  url.searchParams.set("slippageBps", slippageBps.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jupiter quote failed: ${error}`);
  }

  return response.json();
}

export async function buildJupiterSwapInstructions(
  connection: Connection,
  mint: PublicKey,
  buyer: PublicKey,
  solAmountLamports: bigint,
  slippageBps: number = 100
): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> {
  // Step 1: Get quote
  const quote = await getJupiterQuote(mint, solAmountLamports, slippageBps);

  // Step 2: Get swap instructions
  const swapInstructionsResponse = await fetch(JUPITER_SWAP_INSTRUCTIONS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPublicKey: buyer.toBase58(),
      quoteResponse: quote,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });

  if (!swapInstructionsResponse.ok) {
    // Fallback to /swap endpoint if /swap-instructions is not available
    return buildJupiterSwapFallback(connection, mint, buyer, quote);
  }

  const swapData: SwapInstructionsResponse = await swapInstructionsResponse.json();

  // Convert serialized instructions to TransactionInstruction objects
  const instructions: TransactionInstruction[] = [];

  // Add compute budget instructions
  for (const ix of swapData.computeBudgetInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  // Add setup instructions (wrap SOL, create ATA)
  for (const ix of swapData.setupInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  // Add swap instruction
  instructions.push(deserializeInstruction(swapData.swapInstruction));

  // Add cleanup instruction if present
  if (swapData.cleanupInstruction) {
    instructions.push(deserializeInstruction(swapData.cleanupInstruction));
  }

  // Load address lookup tables
  const addressLookupTableAccounts = await loadAddressLookupTables(
    connection,
    swapData.addressLookupTableAddresses
  );

  return { instructions, addressLookupTableAccounts };
}

async function buildJupiterSwapFallback(
  connection: Connection,
  mint: PublicKey,
  buyer: PublicKey,
  quote: QuoteResponse
): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> {
  // Fallback: Use /swap endpoint and deserialize the transaction
  const swapResponse = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPublicKey: buyer.toBase58(),
      quoteResponse: quote,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });

  if (!swapResponse.ok) {
    const error = await swapResponse.text();
    throw new Error(`Jupiter swap failed: ${error}`);
  }

  const { swapTransaction } = await swapResponse.json();

  // Deserialize the versioned transaction
  const txBuffer = Buffer.from(swapTransaction, "base64");
  const versionedTx = VersionedTransaction.deserialize(txBuffer);

  // Extract instructions from the transaction message
  const message = versionedTx.message;

  // Load address lookup tables
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  if (message.addressTableLookups.length > 0) {
    const altAddresses = message.addressTableLookups.map((alt) => alt.accountKey);
    for (const address of altAddresses) {
      const altAccount = await connection.getAddressLookupTable(address);
      if (altAccount.value) {
        addressLookupTableAccounts.push(altAccount.value);
      }
    }
  }

  // Decompile the message to get instructions
  const decompiledMessage = TransactionMessage.decompile(message, {
    addressLookupTableAccounts,
  });

  return {
    instructions: decompiledMessage.instructions,
    addressLookupTableAccounts,
  };
}

function deserializeInstruction(ix: SerializedInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((acc) => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

async function loadAddressLookupTables(
  connection: Connection,
  addresses: string[]
): Promise<AddressLookupTableAccount[]> {
  if (addresses.length === 0) return [];

  const accounts: AddressLookupTableAccount[] = [];

  for (const address of addresses) {
    try {
      const result = await connection.getAddressLookupTable(new PublicKey(address));
      if (result.value) {
        accounts.push(result.value);
      }
    } catch (error) {
      console.error(`Failed to load ALT ${address}:`, error);
    }
  }

  return accounts;
}
