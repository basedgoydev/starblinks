import { Connection, PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "./constants";

export interface TokenState {
  isGraduated: boolean;
  isMayhemMode: boolean;
  bondingCurve: PublicKey | null;
  virtualTokenReserves?: bigint;
  virtualSolReserves?: bigint;
  realTokenReserves?: bigint;
  realSolReserves?: bigint;
}

export function deriveBondingCurvePDA(mint: PublicKey): PublicKey {
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );
  return bondingCurve;
}

export async function getTokenState(
  connection: Connection,
  mint: PublicKey
): Promise<TokenState> {
  const bondingCurve = deriveBondingCurvePDA(mint);

  try {
    const accountInfo = await connection.getAccountInfo(bondingCurve);

    if (!accountInfo) {
      // No bonding curve account = token has graduated or doesn't exist
      return {
        isGraduated: true,
        isMayhemMode: false,
        bondingCurve: null,
      };
    }

    const data = accountInfo.data;

    // Bonding curve account structure (after 8-byte discriminator):
    // virtualTokenReserves: u64 (offset 8)
    // virtualSolReserves: u64 (offset 16)
    // realTokenReserves: u64 (offset 24)
    // realSolReserves: u64 (offset 32)
    // tokenTotalSupply: u64 (offset 40)
    // complete: bool (offset 48)
    // creator: Pubkey (offset 49)
    // isMayhemMode: bool (offset 81) - added Nov 2025

    const complete = data[48] === 1;
    const isMayhemMode = data.length >= 82 ? data[81] === 1 : false;

    // Parse reserves for price calculation
    const virtualTokenReserves = data.readBigUInt64LE(8);
    const virtualSolReserves = data.readBigUInt64LE(16);
    const realTokenReserves = data.readBigUInt64LE(24);
    const realSolReserves = data.readBigUInt64LE(32);

    return {
      isGraduated: complete,
      isMayhemMode,
      bondingCurve,
      virtualTokenReserves,
      virtualSolReserves,
      realTokenReserves,
      realSolReserves,
    };
  } catch (error) {
    console.error("Error fetching token state:", error);
    // Default to graduated if we can't read the bonding curve
    return {
      isGraduated: true,
      isMayhemMode: false,
      bondingCurve: null,
    };
  }
}

export function calculatePrice(state: TokenState): number | null {
  if (!state.virtualTokenReserves || !state.virtualSolReserves) {
    return null;
  }

  // Price = virtualSolReserves / virtualTokenReserves
  // Convert from lamports (1e9) and token units (1e6)
  const solReserves = Number(state.virtualSolReserves) / 1e9;
  const tokenReserves = Number(state.virtualTokenReserves) / 1e6;

  return solReserves / tokenReserves;
}
