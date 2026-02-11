export interface TokenInfo {
  symbol: string;
  name: string;
  image: string | null;
  description?: string;
}

export async function fetchTokenInfo(mint: string): Promise<TokenInfo> {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch token info: ${res.status}`);
    }

    const data = await res.json();

    return {
      symbol: data.symbol || mint.slice(0, 6),
      name: data.name || "Unknown Token",
      image: data.image_uri || null,
      description: data.description || undefined,
    };
  } catch (error) {
    console.error("Error fetching token info:", error);
    return {
      symbol: mint.slice(0, 6),
      name: "Token",
      image: null,
    };
  }
}
