import {
  Connection,
  PublicKey,
  TransactionInstruction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { WSOL_MINT } from "./constants";

const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_INSTRUCTIONS_API = "https://lite-api.jup.ag/swap/v1/swap-instructions";

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
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

/**
 * Build Jupiter swap instructions with platform fee
 * Fee is taken from output tokens and sent to platform's token account
 */
export async function buildJupiterSwapInstructions(
  connection: Connection,
  mint: PublicKey,
  buyer: PublicKey,
  solAmountLamports: bigint,
  platformFeeBps: number, // Fee in basis points (50 = 0.5%)
  platformWallet: PublicKey,
  slippageBps: number = 100
): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> {
  // Get quote with platform fee
  const quoteUrl = new URL(JUPITER_QUOTE_API);
  quoteUrl.searchParams.set("inputMint", WSOL_MINT.toBase58());
  quoteUrl.searchParams.set("outputMint", mint.toBase58());
  quoteUrl.searchParams.set("amount", solAmountLamports.toString());
  quoteUrl.searchParams.set("slippageBps", slippageBps.toString());
  quoteUrl.searchParams.set("platformFeeBps", platformFeeBps.toString());

  const quoteResponse = await fetch(quoteUrl.toString());
  if (!quoteResponse.ok) {
    const error = await quoteResponse.text();
    throw new Error(`Jupiter quote failed: ${error}`);
  }

  const quote: QuoteResponse = await quoteResponse.json();

  // Fee account = platform's token account for the OUTPUT token
  // This is where Jupiter will send the platform fee (in output tokens)
  const feeAccount = getAssociatedTokenAddressSync(mint, platformWallet, true);

  // Get swap instructions with fee account
  const swapResponse = await fetch(JUPITER_SWAP_INSTRUCTIONS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPublicKey: buyer.toBase58(),
      quoteResponse: quote,
      wrapAndUnwrapSol: true, // Jupiter handles SOL wrapping
      dynamicComputeUnitLimit: true,
      feeAccount: feeAccount.toBase58(), // Platform receives fee in output tokens
    }),
  });

  if (!swapResponse.ok) {
    const error = await swapResponse.text();
    throw new Error(`Jupiter swap instructions failed: ${error}`);
  }

  const swapData: SwapInstructionsResponse = await swapResponse.json();

  // Convert serialized instructions
  const instructions: TransactionInstruction[] = [];

  for (const ix of swapData.computeBudgetInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  for (const ix of swapData.setupInstructions) {
    instructions.push(deserializeInstruction(ix));
  }

  instructions.push(deserializeInstruction(swapData.swapInstruction));

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
