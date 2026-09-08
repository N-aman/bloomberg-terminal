/**
 * Options Chain & Derivatives Provider (OMON)
 * Generates options strike chains with computed Black-Scholes Greeks, IV, and Max Pain.
 */

import { calculateBlackScholes, calculateMaxPain, type Greeks } from "../quant/black-scholes";

export type OptionContract = {
  bid: number;
  ask: number;
  last: number;
  ivPct: number;
  volume: number;
  openInterest: number;
  greeks: Greeks;
};

export type StrikeRow = {
  strike: number;
  call: OptionContract;
  put: OptionContract;
};

export type OptionChain = {
  symbol: string;
  spotPrice: number;
  expirationDate: string;
  daysToExpiry: number;
  impliedVolIndexPct: number;
  putCallRatio: number;
  maxPainStrike: number;
  strikes: StrikeRow[];
  stale?: boolean;
};

const SPOT_BENCHMARKS: Record<string, { price: number; iv: number }> = {
  AAPL: { price: 228.50, iv: 24.5 },
  NVDA: { price: 125.80, iv: 46.2 },
  TSLA: { price: 212.40, iv: 58.4 },
  MSFT: { price: 420.30, iv: 22.1 },
  SPY: { price: 558.90, iv: 14.8 },
  BTC: { price: 79800.0, iv: 54.0 },
};

/**
 * Generates complete Options Chain with Black-Scholes Greeks
 */
export function generateOptionChain(symbol: string, daysToExpiry = 30): OptionChain {
  const sym = symbol.trim().toUpperCase().replace("USDT", "");
  const base = SPOT_BENCHMARKS[sym] ?? { price: 150.0, iv: 30.0 };
  const S = base.price;
  const baseIv = base.iv / 100;
  const T = daysToExpiry / 365;
  const r = 0.045; // 4.5% risk-free rate

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysToExpiry);
  const expirationDate = expiry.toISOString().slice(0, 10);

  // Strike range: ± 15% around spot
  const step = S > 1000 ? 500 : S > 300 ? 5 : S > 100 ? 2.5 : 1;
  const minStrike = Math.floor((S * 0.85) / step) * step;
  const maxStrike = Math.ceil((S * 1.15) / step) * step;

  const strikes: StrikeRow[] = [];
  const maxPainData: { strike: number; callOi: number; putOi: number }[] = [];

  let totalCallVol = 0;
  let totalPutVol = 0;

  for (let K = minStrike; K <= maxStrike; K += step) {
    // Volatility Smile effect: OTM options have slightly higher IV
    const moneyness = Math.abs(Math.log(S / K));
    const strikeIv = baseIv + moneyness * 0.12;

    const bs = calculateBlackScholes(S, K, T, r, strikeIv);

    // Realistic Bid/Ask spreads
    const callSpread = Math.max(0.05, bs.call.price * 0.03);
    const putSpread = Math.max(0.05, bs.put.price * 0.03);

    const callBid = Math.max(0.01, Math.round((bs.call.price - callSpread / 2) * 100) / 100);
    const callAsk = Math.round((bs.call.price + callSpread / 2) * 100) / 100;
    const putBid = Math.max(0.01, Math.round((bs.put.price - putSpread / 2) * 100) / 100);
    const putAsk = Math.round((bs.put.price + putSpread / 2) * 100) / 100;

    const callOi = Math.floor(200 + Math.random() * 4800);
    const putOi = Math.floor(200 + Math.random() * 4800);
    const callVol = Math.floor(callOi * (0.1 + Math.random() * 0.4));
    const putVol = Math.floor(putOi * (0.1 + Math.random() * 0.4));

    totalCallVol += callVol;
    totalPutVol += putVol;

    maxPainData.push({ strike: K, callOi, putOi });

    strikes.push({
      strike: K,
      call: {
        bid: callBid,
        ask: callAsk,
        last: Math.round(((callBid + callAsk) / 2) * 100) / 100,
        ivPct: Math.round(strikeIv * 1000) / 10,
        volume: callVol,
        openInterest: callOi,
        greeks: bs.call,
      },
      put: {
        bid: putBid,
        ask: putAsk,
        last: Math.round(((putBid + putAsk) / 2) * 100) / 100,
        ivPct: Math.round(strikeIv * 1000) / 10,
        volume: putVol,
        openInterest: putOi,
        greeks: bs.put,
      },
    });
  }

  const maxPainStrike = calculateMaxPain(maxPainData);
  const putCallRatio = totalCallVol > 0 ? Math.round((totalPutVol / totalCallVol) * 100) / 100 : 1.0;

  return {
    symbol: sym,
    spotPrice: S,
    expirationDate,
    daysToExpiry,
    impliedVolIndexPct: base.iv,
    putCallRatio,
    maxPainStrike,
    strikes,
    stale: false,
  };
}
