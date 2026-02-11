import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  PLATFORM_WALLET,
  TOTAL_FEE_BPS,
  PLATFORM_SHARE_PCT,
  AFFILIATE_SHARE_PCT,
} from "./constants";

export interface FeeBreakdown {
  totalFeeLamports: bigint;
  platformFeeLamports: bigint;
  affiliateFeeLamports: bigint;
  netAmountLamports: bigint;
}

export function calculateFees(
  solAmountLamports: bigint,
  hasReferrer: boolean
): FeeBreakdown {
  // Total fee is 0.5% (50 bps)
  const totalFeeLamports =
    (solAmountLamports * BigInt(TOTAL_FEE_BPS)) / BigInt(10000);

  let platformFeeLamports: bigint;
  let affiliateFeeLamports: bigint;

  if (hasReferrer) {
    // Split fees: 60% platform (0.3%), 40% affiliate (0.2%)
    platformFeeLamports =
      (totalFeeLamports * BigInt(PLATFORM_SHARE_PCT)) / BigInt(100);
    affiliateFeeLamports = totalFeeLamports - platformFeeLamports;
  } else {
    // No referrer: 100% to platform (0.5%)
    platformFeeLamports = totalFeeLamports;
    affiliateFeeLamports = BigInt(0);
  }

  const netAmountLamports = solAmountLamports - totalFeeLamports;

  return {
    totalFeeLamports,
    platformFeeLamports,
    affiliateFeeLamports,
    netAmountLamports,
  };
}

export function buildFeeInstructions(
  buyer: PublicKey,
  referrer: PublicKey | null,
  feeBreakdown: FeeBreakdown
): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];

  // Platform fee transfer
  if (feeBreakdown.platformFeeLamports > BigInt(0)) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: PLATFORM_WALLET,
        lamports: feeBreakdown.platformFeeLamports,
      })
    );
  }

  // Affiliate fee transfer (if referrer exists)
  if (referrer && feeBreakdown.affiliateFeeLamports > BigInt(0)) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: referrer,
        lamports: feeBreakdown.affiliateFeeLamports,
      })
    );
  }

  return instructions;
}

export function validateReferrer(ref: string | null): PublicKey | null {
  if (!ref) return null;

  try {
    const pubkey = new PublicKey(ref);

    // Validate that it's a valid ed25519 public key on the curve
    if (!PublicKey.isOnCurve(pubkey)) {
      console.warn(`Referrer ${ref} is not on curve, ignoring`);
      return null;
    }

    // Don't allow self-referral to platform wallet
    if (pubkey.equals(PLATFORM_WALLET)) {
      console.warn("Referrer is platform wallet, ignoring");
      return null;
    }

    return pubkey;
  } catch (error) {
    console.warn(`Invalid referrer address: ${ref}`);
    return null;
  }
}

export function formatFeeDisplay(solAmount: number, hasReferrer: boolean): string {
  const feePercent = TOTAL_FEE_BPS / 100;
  const platformPercent = hasReferrer
    ? (TOTAL_FEE_BPS * PLATFORM_SHARE_PCT) / 10000
    : feePercent;
  const affiliatePercent = hasReferrer
    ? (TOTAL_FEE_BPS * AFFILIATE_SHARE_PCT) / 10000
    : 0;

  if (hasReferrer) {
    return `${feePercent}% fee (${platformPercent}% platform + ${affiliatePercent}% affiliate)`;
  }
  return `${feePercent}% fee`;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}
