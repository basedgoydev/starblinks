import { NextRequest, NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ACTIONS_CORS_HEADERS } from "@/lib/cors";
import { getConnection } from "@/lib/connection";
import { getTokenState, calculatePrice } from "@/lib/token-state";
import { fetchTokenInfo } from "@/lib/token-info";
import { validateReferrer, solToLamports, formatFeeDisplay } from "@/lib/fees";
import { buildBuyTransaction } from "@/lib/transaction";
import { APP_URL, TOTAL_FEE_BPS } from "@/lib/constants";

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });
}

// GET - Return Blink metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint: mintStr } = await params;

    // Validate mint address
    let mint: PublicKey;
    try {
      mint = new PublicKey(mintStr);
    } catch {
      return NextResponse.json(
        { error: "Invalid mint address" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Fetch token info and state in parallel
    const [tokenInfo, tokenState] = await Promise.all([
      fetchTokenInfo(mintStr),
      getTokenState(getConnection(), mint),
    ]);

    // Get referrer from URL params and base URL
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const ref = url.searchParams.get("ref");
    const refParam = ref ? `&ref=${ref}` : "";

    // Build description
    let description: string;
    if (tokenState.isGraduated) {
      description = `Graduated token | Trading on Jupiter`;
    } else {
      const price = calculatePrice(tokenState);
      description = price
        ? `Price: ${price.toFixed(10)} SOL per token`
        : `Token on bonding curve`;
    }
    // Add fee info (fees only apply for amounts >= 0.1 SOL)
    description += ` | ${TOTAL_FEE_BPS / 100}% fee on orders ≥0.1 SOL${ref ? " (incl. affiliate)" : ""}`;

    const response = {
      type: "action",
      icon: tokenInfo.image || `${APP_URL}/default-token.svg`,
      title: `Buy $${tokenInfo.symbol}`,
      description,
      label: "Buy",
      links: {
        actions: [
          {
            label: "0.1 SOL",
            href: `${baseUrl}/api/actions/${mintStr}?amount=0.1${refParam}`,
          },
          {
            label: "0.5 SOL",
            href: `${baseUrl}/api/actions/${mintStr}?amount=0.5${refParam}`,
          },
          {
            label: "1 SOL",
            href: `${baseUrl}/api/actions/${mintStr}?amount=1${refParam}`,
          },
          {
            label: "Custom",
            href: `${baseUrl}/api/actions/${mintStr}?amount={amount}${refParam}`,
            parameters: [
              {
                name: "amount",
                label: "SOL amount",
                type: "number",
                required: true,
                min: 0.05,
                max: 100,
              },
            ],
          },
        ],
      },
    };

    return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch token info" },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}

// POST - Build and return transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint: mintStr } = await params;

    // Validate mint address
    let mint: PublicKey;
    try {
      mint = new PublicKey(mintStr);
    } catch {
      return NextResponse.json(
        { error: "Invalid mint address" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Parse URL params
    const url = new URL(request.url);
    const amountStr = url.searchParams.get("amount");
    const ref = url.searchParams.get("ref");

    // Validate amount
    const amount = parseFloat(amountStr || "0");
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be greater than 0." },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (amount < 0.05) {
      return NextResponse.json(
        { error: "Minimum amount is 0.05 SOL" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (amount > 100) {
      return NextResponse.json(
        { error: "Maximum amount is 100 SOL" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Parse request body
    const body = await request.json();
    const { account } = body;

    if (!account) {
      return NextResponse.json(
        { error: "Missing account in request body" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Validate buyer address
    let buyer: PublicKey;
    try {
      buyer = new PublicKey(account);
    } catch {
      return NextResponse.json(
        { error: "Invalid account address" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Validate referrer (returns null if invalid)
    const referrer = validateReferrer(ref);

    // Don't allow self-referral
    if (referrer && referrer.equals(buyer)) {
      return NextResponse.json(
        { error: "Self-referral is not allowed" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Convert SOL to lamports
    const solAmountLamports = solToLamports(amount);

    // Build the transaction
    const { transaction, feeBreakdown, tokenState } = await buildBuyTransaction({
      mint,
      buyer,
      solAmountLamports,
      referrer,
    });

    // Build response message
    const feePercent = TOTAL_FEE_BPS / 100;
    const routeInfo = tokenState.isGraduated
      ? "via Jupiter"
      : "via Pump.fun bonding curve";
    const feeInfo = amount >= 0.1
      ? ` (${feePercent}% fee${referrer ? " incl. affiliate" : ""})`
      : "";
    const message = `Buying with ${amount} SOL${feeInfo} ${routeInfo}`;

    return NextResponse.json(
      { transaction, message },
      { headers: ACTIONS_CORS_HEADERS }
    );
  } catch (error) {
    console.error("POST error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to build transaction";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}
