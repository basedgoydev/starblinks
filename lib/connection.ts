import { Connection, Commitment } from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

let connection: Connection | null = null;

export function getConnection(commitment: Commitment = "confirmed"): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, {
      commitment,
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}
