import { PublicKey } from "@solana/web3.js";

// Pump.fun Program Addresses
export const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);

export const PUMP_GLOBAL_STATE = new PublicKey(
  "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf"
);

export const PUMP_FEE_RECIPIENT = new PublicKey(
  "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM"
);

export const PUMP_FEE_RECIPIENT_MAYHEM = new PublicKey(
  "GesfTA3X2arioaHp8bbKdjG9vJtskViWACZoYvxp4twS"
);

export const PUMPSWAP_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"
);

// Solana native
export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

// Platform configuration
export const PLATFORM_WALLET = new PublicKey(
  process.env.PLATFORM_WALLET || "11111111111111111111111111111111"
);

// Fee configuration (basis points)
export const TOTAL_FEE_BPS = parseInt(process.env.TOTAL_FEE_BPS || "50"); // 0.5%
export const PLATFORM_SHARE_PCT = parseInt(process.env.PLATFORM_SHARE_PCT || "60"); // 60% of fees
export const AFFILIATE_SHARE_PCT = parseInt(process.env.AFFILIATE_SHARE_PCT || "40"); // 40% of fees

// Pump.fun token decimals (NOT 9 like standard SPL)
export const PUMP_TOKEN_DECIMALS = 6;

// App URL
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
