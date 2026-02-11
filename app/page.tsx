import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-pump-dark text-white">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-pump-green">Star</span>Blinks
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-8">
            Buy any Pump.fun token with one click directly from Twitter.
            <br />
            Earn 0.2% affiliate fees by sharing links.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/share"
              className="px-8 py-4 bg-pump-green text-black font-bold rounded-lg hover:bg-green-400 transition-colors text-lg"
            >
              Create Affiliate Link
            </Link>
            <a
              href="https://github.com/basedgoydev/starblinks"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-pump-gray text-white font-bold rounded-lg hover:bg-gray-700 transition-colors text-lg"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-pump-gray rounded-2xl p-8">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-xl font-bold mb-3">Permissionless</h3>
            <p className="text-gray-400">
              No signup, no approval needed. Anyone can create affiliate links for any
              Pump.fun token instantly.
            </p>
          </div>
          <div className="bg-pump-gray rounded-2xl p-8">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-3">One-Click Buy</h3>
            <p className="text-gray-400">
              Twitter users see an interactive widget. Click, sign, done. No need to
              leave Twitter.
            </p>
          </div>
          <div className="bg-pump-gray rounded-2xl p-8">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-3">Instant Earnings</h3>
            <p className="text-gray-400">
              Affiliate fees (0.2%) are paid directly to your wallet in the same
              transaction. No claiming needed.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-pump-green text-black rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">Find a Token</h4>
                  <p className="text-gray-400">
                    Copy the mint address of any Pump.fun token you want to promote.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-pump-green text-black rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">Generate Your Link</h4>
                  <p className="text-gray-400">
                    Add your wallet address and get your unique affiliate link.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-pump-green text-black rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">Share on Twitter</h4>
                  <p className="text-gray-400">
                    Tweet your link. It appears as an interactive Blink widget.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-pump-green text-black rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">Earn on Every Purchase</h4>
                  <p className="text-gray-400">
                    Get 0.2% of every buy made through your link, paid instantly.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-pump-gray rounded-2xl p-8">
              <div className="bg-pump-dark rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-pump-green rounded-full"></div>
                  <div>
                    <div className="font-bold">$EXAMPLE</div>
                    <div className="text-sm text-gray-400">Buy via StarBlinks</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button className="py-2 bg-pump-gray rounded-lg text-sm">
                    0.1 SOL
                  </button>
                  <button className="py-2 bg-pump-gray rounded-lg text-sm">
                    0.5 SOL
                  </button>
                  <button className="py-2 bg-pump-gray rounded-lg text-sm">
                    1 SOL
                  </button>
                </div>
                <div className="text-xs text-gray-500 text-center">
                  0.5% fee (0.3% platform + 0.2% affiliate)
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-4">
                Example Blink widget as seen on Twitter
              </p>
            </div>
          </div>
        </div>

        {/* Fee Structure */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Fee Structure</h2>
          <div className="max-w-2xl mx-auto bg-pump-gray rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-pump-dark">
                <tr>
                  <th className="px-6 py-4 text-left">Scenario</th>
                  <th className="px-6 py-4 text-right">Platform</th>
                  <th className="px-6 py-4 text-right">Affiliate</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-700">
                  <td className="px-6 py-4">With Affiliate Link</td>
                  <td className="px-6 py-4 text-right">0.3%</td>
                  <td className="px-6 py-4 text-right text-pump-green">0.2%</td>
                  <td className="px-6 py-4 text-right">0.5%</td>
                </tr>
                <tr className="border-t border-gray-700">
                  <td className="px-6 py-4">Without Affiliate</td>
                  <td className="px-6 py-4 text-right">0.5%</td>
                  <td className="px-6 py-4 text-right text-gray-500">-</td>
                  <td className="px-6 py-4 text-right">0.5%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-center text-gray-400 mt-4">
            Users pay the same 0.5% fee regardless. Affiliates get their share from
            the platform cut.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Start Earning?</h2>
          <Link
            href="/share"
            className="inline-block px-12 py-4 bg-pump-green text-black font-bold rounded-lg hover:bg-green-400 transition-colors text-xl"
          >
            Create Your First Link
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-400">
            Built by{" "}
            <a
              href="https://twitter.com/starcat_team"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pump-green hover:underline"
            >
              Starcat
            </a>
          </div>
          <div className="flex gap-6">
            <a
              href="https://github.com/basedgoydev/starblinks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/starcat_team"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
