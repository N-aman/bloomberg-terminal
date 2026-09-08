/**
 * CoinGecko API — global crypto market data.
 * Free demo plan: 100 calls/min, no credit card.
 * COINGECKO_API_KEY env var is optional — if absent, makes keyless calls
 * (lower rate limit but works fine with caching).
 * https://docs.coingecko.com/reference/global-crypto-market-data
 */

export type CryptoGlobal = {
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChange24h: number; // percentage
  activeCryptocurrencies: number;
};

type CoinGeckoGlobalResponse = {
  data: {
    active_cryptocurrencies: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
};

export async function fetchCryptoGlobal(signal: AbortSignal): Promise<CryptoGlobal> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  const response = await fetch("https://api.coingecko.com/api/v3/global", {
    headers,
    signal,
  });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);

  const data = await response.json() as CoinGeckoGlobalResponse;
  const d = data.data;
  return {
    totalMarketCapUsd: d.total_market_cap.usd ?? 0,
    totalVolume24hUsd: d.total_volume.usd ?? 0,
    btcDominance: d.market_cap_percentage.btc ?? 0,
    ethDominance: d.market_cap_percentage.eth ?? 0,
    marketCapChange24h: d.market_cap_change_percentage_24h_usd ?? 0,
    activeCryptocurrencies: d.active_cryptocurrencies ?? 0,
  };
}
