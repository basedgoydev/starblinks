import Link from "next/link";
import Image from "next/image";
import { fetchTokenInfo } from "@/lib/token-info";

interface BuyPageProps {
  params: Promise<{ mint: string }>;
  searchParams: Promise<{ ref?: string }>;
}

export default async function BuyPage({ params, searchParams }: BuyPageProps) {
  const { mint } = await params;
  const { ref } = await searchParams;

  const tokenInfo = await fetchTokenInfo(mint);

  const pumpFunUrl = `https://pump.fun/${mint}`;

  return (
    <div className="min-h-screen bg-pump-dark text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-pump-gray rounded-2xl p-8 text-center">
        {/* Token Info */}
        <div className="mb-6">
          {tokenInfo.image && (
            <Image
              src={tokenInfo.image}
              alt={tokenInfo.symbol}
              width={96}
              height={96}
              className="rounded-full mx-auto mb-4"
              unoptimized
            />
          )}
          <h1 className="text-2xl font-bold">${tokenInfo.symbol}</h1>
          <p className="text-gray-400">{tokenInfo.name}</p>
        </div>

        {/* Blink Explanation */}
        <div className="mb-6 p-4 bg-pump-dark rounded-xl">
          <p className="text-sm text-gray-400">
            This link is a Solana Blink. To use it, you need:
          </p>
          <ul className="text-sm text-gray-400 mt-2 text-left list-disc list-inside">
            <li>Phantom or Backpack wallet extension</li>
            <li>Blinks enabled in wallet settings</li>
            <li>View this link on Twitter</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={pumpFunUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 bg-pump-green text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
          >
            Buy on Pump.fun
          </a>
          <Link
            href="/"
            className="block w-full py-3 bg-pump-dark text-white font-bold rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
          >
            Learn More About StarBlinks
          </Link>
        </div>

        {/* Mint Address */}
        <div className="mt-6 p-3 bg-pump-dark rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Token Mint</p>
          <p className="text-xs text-gray-300 font-mono break-all">{mint}</p>
        </div>

        {ref && (
          <p className="text-xs text-gray-500 mt-4">
            Affiliate: {ref.slice(0, 4)}...{ref.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
}
