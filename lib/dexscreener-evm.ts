// lib/dexscreener-evm.ts
import axios from 'axios';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

export interface DexPrice {
  chainId: string;
  dexId: string;
  dexName: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  pairUrl: string;
}

export const EVM_CHAINS = [
  'ethereum',
  'arbitrum',
  'base',
  'bsc',
  'polygon',
  'avalanche',
  'optimism',
] as const;

type ChainId = typeof EVM_CHAINS[number];

export const TOKENS_TO_TRACK = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    addresses: {
      ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      arbitrum: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      bsc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      polygon: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      avalanche: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      optimism: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    },
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    addresses: {
      ethereum: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      arbitrum: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      base: '0xfde4c96c8593536e31f229ea8f37b6ada2699bb2',
      bsc: '0x55d398326f99059ff775485246999027b3197955',
      polygon: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      avalanche: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
      optimism: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    },
  },
  {
    symbol: 'WETH',
    name: 'Wrapped ETH',
    addresses: {
      ethereum: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      arbitrum: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      base: '0x4200000000000000000000000000000000000006',
      optimism: '0x4200000000000000000000000000000000000006',
      // BSC & Polygon & Avalanche usually use wrapped native (WBNB, WMATIC, WAVAX)
    },
  },
  // You can add WBTC, DAI, LINK etc. similarly
] as const;

export async function getEvmDexPricesForToken(
  token: typeof TOKENS_TO_TRACK[number]
): Promise<{ tokenSymbol: string; prices: DexPrice[]; spreadPercent: number | null }> {
  const results: DexPrice[] = [];

  for (const [chain, addr] of Object.entries(token.addresses)) {
    if (!EVM_CHAINS.includes(chain as ChainId)) continue;

    try {
      const { data } = await axios.get(
        `${DEXSCREENER_API}/tokens/${addr}`,
        { timeout: 7000 }
      );

      if (!data?.pairs?.length) continue;

      // Pick pair with highest liquidity on this chain
      const bestPair = data.pairs
        .filter((p: any) => EVM_CHAINS.includes(p.chainId))
        .reduce((prev: any, curr: any) =>
          (curr.liquidity?.usd || 0) > (prev.liquidity?.usd || 0) ? curr : prev,
          { liquidity: { usd: 0 } }
        );

      if (!bestPair?.priceUsd) continue;

      results.push({
        chainId: bestPair.chainId,
        dexId: bestPair.dexId,
        dexName: bestPair.dexId.charAt(0).toUpperCase() + bestPair.dexId.slice(1),
        priceUsd: Number(bestPair.priceUsd),
        liquidityUsd: bestPair.liquidity?.usd || null,
        volume24h: bestPair.volume?.h24 || null,
        pairUrl: bestPair.url,
      });
    } catch (err) {
      console.error(`Error fetching ${token.symbol} on ${chain}:`, err);
    }
  }

  if (results.length < 2) {
    return { tokenSymbol: token.symbol, prices: results, spreadPercent: null };
  }

  const validPrices = results
    .filter(p => p.priceUsd !== null)
    .map(p => p.priceUsd!);

  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  const spread = ((max - min) / min) * 100;

  return {
    tokenSymbol: token.symbol,
    prices: results,
    spreadPercent: spread,
  };
}

export async function getAllEvmDexArbitrage() {
  const promises = TOKENS_TO_TRACK.map(getEvmDexPricesForToken);
  return Promise.all(promises);
}
