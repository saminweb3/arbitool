// app/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { getAllEvmDexArbitrage } from '@/lib/dexscreener-evm';
import { RefreshCw, ExternalLink, Play, Pause, Copy } from 'lucide-react';

type ArbResult = Awaited<ReturnType<typeof getAllEvmDexArbitrage>>[number];

export default function Home() {
  const [data, setData] = useState<ArbResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await getAllEvmDexArbitrage();
      setData(results.filter(r => r.prices.length > 0));
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData(); // initial load

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchData, 15000); // 15s
    }
    return () => { if (interval) clearInterval(interval); };
  }, [autoRefresh]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white py-10 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold">EVM DEX Arbitrage Monitor</h1>
          <p className="text-lg text-gray-400">
            Price differences for stables &amp; wrapped assets across EVM chains (Uniswap, PancakeSwap, QuickSwap...)
          </p>
          <p className="text-sm text-gray-500">
            Last update: {lastUpdate.toLocaleTimeString()} • Data: DexScreener
          </p>

          {/* Tool Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh Now
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition ${
                autoRefresh
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {autoRefresh ? <Pause size={18} /> : <Play size={18} />}
              {autoRefresh ? 'Stop Auto (15s)' : 'Start Auto-refresh'}
            </button>

            {data.length > 0 && (
              <button
                onClick={() => {
                  const text = data
                    .map(r => `${r.tokenSymbol} spread: ${r.spreadPercent?.toFixed(2) ?? '?'}%`)
                    .join('\n');
                  copyToClipboard(text);
                }}
                className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
              >
                <Copy size={18} />
                Copy Spreads
              </button>
            )}
          </div>
        </div>

        {loading && data.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <RefreshCw className="animate-spin h-12 w-12 mb-4 text-blue-400" />
            <p className="text-xl">Loading EVM DEX prices...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {data.map((res) => {
              const hasSpread = res.spreadPercent !== null && res.spreadPercent > 0.05;

              return (
                <section key={res.tokenSymbol} className="space-y-5">
                  <h2 className="text-3xl font-semibold text-center">
                    {res.tokenSymbol}
                    {hasSpread && (
                      <span className="ml-4 text-2xl font-bold">
                        Spread:{' '}
                        <span className={res.spreadPercent! > 0.5 ? 'text-green-400' : 'text-yellow-400'}>
                          {res.spreadPercent!.toFixed(3)}%
                        </span>
                      </span>
                    )}
                  </h2>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {res.prices
                      .sort((a, b) => (a.priceUsd ?? 0) - (b.priceUsd ?? 0))
                      .map((p, i) => {
                        const isLowest = p.priceUsd === Math.min(...res.prices.map(pp => pp.priceUsd ?? Infinity));
                        const isHighest = p.priceUsd === Math.max(...res.prices.map(pp => pp.priceUsd ?? -Infinity));

                        return (
                          <div
                            key={i}
                            className={`p-5 rounded-xl border transition-all ${
                              isLowest
                                ? 'bg-green-950/40 border-green-700/50 scale-105'
                                : isHighest
                                ? 'bg-red-950/40 border-red-700/50 scale-105'
                                : 'bg-gray-800/40 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <div className="font-bold text-lg">{p.dexName}</div>
                            <div className="text-sm text-gray-400 uppercase">{p.chainId}</div>

                            <div className="text-2xl font-mono mt-3">
                              ${p.priceUsd?.toFixed(6) || '—'}
                            </div>

                            <div className="mt-4 text-sm space-y-1 opacity-80">
                              <div>Liquidity: ${p.liquidityUsd?.toLocaleString() ?? 'low'}</div>
                              <div>24h Vol: ${p.volume24h?.toLocaleString() ?? '—'}</div>
                            </div>

                            <a
                              href={p.pairUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center text-blue-400 hover:text-blue-300 text-sm"
                            >
                              View Pair <ExternalLink size={14} className="ml-1" />
                            </a>
                          </div>
                        );
                      })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <footer className="text-center text-sm text-gray-500 pt-10">
          Educational tool only • Real arb rarely survives gas + slippage + MEV • Not financial advice
        </footer>
      </div>
    </main>
  );
}
