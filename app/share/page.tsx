"use client";

import { useState, useCallback } from "react";

export default function SharePage() {
  const [mint, setMint] = useState("");
  const [wallet, setWallet] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [dialLink, setDialLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const validateSolanaAddress = (address: string): boolean => {
    // Basic validation: 32-44 characters, base58
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  const generateLink = useCallback(() => {
    setError("");
    setCopied(false);

    if (!mint.trim()) {
      setError("Please enter a token mint address");
      return;
    }

    if (!validateSolanaAddress(mint.trim())) {
      setError("Invalid token mint address");
      return;
    }

    if (!wallet.trim()) {
      setError("Please enter your wallet address");
      return;
    }

    if (!validateSolanaAddress(wallet.trim())) {
      setError("Invalid wallet address");
      return;
    }

    const baseUrl = window.location.origin;
    const link = `${baseUrl}/buy/${mint.trim()}?ref=${wallet.trim()}`;
    const dial = `https://dial.to/?action=solana-action:${encodeURIComponent(link)}`;

    setGeneratedLink(link);
    setDialLink(dial);
  }, [mint, wallet]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  }, []);

  const openTwitter = useCallback(() => {
    const text = `Buy this token with one click!\n\n`;
    const url = dialLink || generatedLink;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank");
  }, [generatedLink, dialLink]);

  return (
    <div className="min-h-screen bg-pump-dark text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-2 text-center">
          <span className="text-pump-green">StarBlinks</span> Affiliate Links
        </h1>
        <p className="text-gray-400 text-center mb-12">
          Generate affiliate links and earn 0.2% on every purchase made through your link
        </p>

        <div className="bg-pump-gray rounded-xl p-6 space-y-6">
          {/* Token Mint Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Token Mint Address
            </label>
            <input
              type="text"
              placeholder="Enter Pump.fun token mint address"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              className="w-full px-4 py-3 bg-pump-dark border border-gray-700 rounded-lg focus:outline-none focus:border-pump-green transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Find this on Pump.fun or Solscan
            </p>
          </div>

          {/* Wallet Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Wallet Address
            </label>
            <input
              type="text"
              placeholder="Enter your Solana wallet address"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="w-full px-4 py-3 bg-pump-dark border border-gray-700 rounded-lg focus:outline-none focus:border-pump-green transition-colors"
            />
            <p className="text-xs text-gray-500 mt-1">
              Affiliate fees will be sent directly to this wallet
            </p>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateLink}
            className="w-full py-3 bg-pump-green text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
          >
            Generate Affiliate Link
          </button>

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          {/* Generated Link Display */}
          {generatedLink && (
            <div className="space-y-4 pt-4 border-t border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Affiliate Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 px-4 py-3 bg-pump-dark border border-gray-700 rounded-lg text-sm text-gray-300"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedLink)}
                    className="px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Dial.to Link (for Twitter unfurl)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dialLink}
                    readOnly
                    className="flex-1 px-4 py-3 bg-pump-dark border border-gray-700 rounded-lg text-sm text-gray-300"
                  />
                  <button
                    onClick={() => copyToClipboard(dialLink)}
                    className="px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use this link until your domain is approved on Dialect Registry
                </p>
              </div>

              {/* Tweet Button */}
              <button
                onClick={openTwitter}
                className="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Tweet This Link
              </button>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold text-center">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-pump-gray rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">1</div>
              <h3 className="font-bold mb-2">Generate Link</h3>
              <p className="text-sm text-gray-400">
                Enter any Pump.fun token mint and your wallet address
              </p>
            </div>
            <div className="bg-pump-gray rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">2</div>
              <h3 className="font-bold mb-2">Share on Twitter</h3>
              <p className="text-sm text-gray-400">
                Tweet your link - it displays as an interactive Blink widget
              </p>
            </div>
            <div className="bg-pump-gray rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">3</div>
              <h3 className="font-bold mb-2">Earn 0.2%</h3>
              <p className="text-sm text-gray-400">
                Get 0.2% of every purchase made through your link, directly to your wallet
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold text-center mb-6">FAQ</h2>

          <details className="bg-pump-gray rounded-xl p-4">
            <summary className="font-bold cursor-pointer">
              Do I need to sign up?
            </summary>
            <p className="mt-2 text-gray-400">
              No! Just paste your wallet address. No signup, no KYC, no accounts.
            </p>
          </details>

          <details className="bg-pump-gray rounded-xl p-4">
            <summary className="font-bold cursor-pointer">
              How do I receive my affiliate fees?
            </summary>
            <p className="mt-2 text-gray-400">
              Fees are sent directly to your wallet in the same transaction as the purchase.
              No claiming, no waiting - it&apos;s instant and on-chain.
            </p>
          </details>

          <details className="bg-pump-gray rounded-xl p-4">
            <summary className="font-bold cursor-pointer">
              What tokens can I promote?
            </summary>
            <p className="mt-2 text-gray-400">
              Any Pump.fun token - whether it&apos;s still on bonding curve or graduated to Jupiter/PumpSwap.
            </p>
          </details>

          <details className="bg-pump-gray rounded-xl p-4">
            <summary className="font-bold cursor-pointer">
              Why use the dial.to link?
            </summary>
            <p className="mt-2 text-gray-400">
              Until our domain is approved on Dialect Registry, the dial.to wrapper ensures
              your links display as interactive Blink widgets on Twitter.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
