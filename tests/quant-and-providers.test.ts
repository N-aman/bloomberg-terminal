/**
 * Unit tests for Black-Scholes Option Pricing, Technical Indicators, and Economic Calendar
 */

import { describe, it, expect } from "vitest";
import {
  calculateBlackScholes,
  calculateMaxPain,
  normalCdf,
} from "../lib/quant/black-scholes";
import {
  calculateSma,
  calculateRsi,
  type OhlcvBar,
} from "../lib/providers/chart";
import { generateInstitutionalCalendar } from "../lib/providers/calendar";
import { generateOptionChain } from "../lib/providers/options";

describe("Quantitative Engine — Black-Scholes & Greeks", () => {
  it("normal cumulative distribution function approximations are accurate", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });

  it("computes call and put prices respecting Put-Call Parity (C - P = S - K*e^-rT)", () => {
    const S = 100;
    const K = 100;
    const T = 1.0;
    const r = 0.05;
    const sigma = 0.20;

    const { call, put } = calculateBlackScholes(S, K, T, r, sigma);

    // Theoretical call should be ~10.45, put should be ~5.57
    expect(call.price).toBeGreaterThan(0);
    expect(put.price).toBeGreaterThan(0);

    const discountFactor = Math.exp(-r * T);
    const expectedDifference = S - K * discountFactor;
    const actualDifference = call.price - put.price;

    expect(actualDifference).toBeCloseTo(expectedDifference, 0);
  });

  it("calculates accurate Delta for ATM, ITM, and OTM options", () => {
    const S = 100;
    const T = 0.25;

    const atm = calculateBlackScholes(S, 100, T);
    expect(atm.call.delta).toBeGreaterThan(0.4);
    expect(atm.call.delta).toBeLessThan(0.65);
    expect(atm.put.delta).toBeLessThan(-0.35);
    expect(atm.put.delta).toBeGreaterThan(-0.6);

    const deepItmCall = calculateBlackScholes(S, 70, T);
    expect(deepItmCall.call.delta).toBeGreaterThan(0.95);

    const deepOtmCall = calculateBlackScholes(S, 140, T);
    expect(deepOtmCall.call.delta).toBeLessThan(0.1);
  });

  it("inverts market option prices to solve exact Implied Volatility (IV)", async () => {
    const { solveImpliedVolatility } = await import("../lib/quant/black-scholes");
    const S = 100;
    const K = 100;
    const T = 0.5;
    const r = 0.045;
    const trueSigma = 0.28;

    const forward = calculateBlackScholes(S, K, T, r, trueSigma);
    const solvedCallIv = solveImpliedVolatility(forward.call.price, S, K, T, r, "call");
    const solvedPutIv = solveImpliedVolatility(forward.put.price, S, K, T, r, "put");

    expect(solvedCallIv).toBeCloseTo(trueSigma, 2);
    expect(solvedPutIv).toBeCloseTo(trueSigma, 2);

    // Deep OTM option test (triggers bisection fallback safely)
    const deepOtmPrice = 0.05;
    const otmIv = solveImpliedVolatility(deepOtmPrice, 100, 150, 0.1, r, "call");
    expect(otmIv).toBeGreaterThan(0);
    expect(otmIv).toBeLessThan(2.0);
  });

  it("calculates Max Pain strike correctly", () => {
    const testStrikes = [
      { strike: 90, callOi: 100, putOi: 5000 },
      { strike: 95, callOi: 500, putOi: 3000 },
      { strike: 100, callOi: 2000, putOi: 2000 },
      { strike: 105, callOi: 4000, putOi: 500 },
      { strike: 110, callOi: 6000, putOi: 100 },
    ];

    const maxPain = calculateMaxPain(testStrikes);
    expect(maxPain).toBe(100);
  });

  it("generates structured Option Chain with strikes and metrics", () => {
    const chain = generateOptionChain("AAPL", 30);
    expect(chain.symbol).toBe("AAPL");
    expect(chain.spotPrice).toBeGreaterThan(0);
    expect(chain.strikes.length).toBeGreaterThan(5);
    expect(chain.putCallRatio).toBeGreaterThan(0);

    const midStrike = chain.strikes[Math.floor(chain.strikes.length / 2)];
    expect(midStrike.call.bid).toBeDefined();
    expect(midStrike.put.ask).toBeDefined();
    expect(midStrike.call.greeks.delta).toBeDefined();
  });
});

describe("Technical Analysis — SMA & RSI Indicators", () => {
  const dummyBars: OhlcvBar[] = Array.from({ length: 30 }, (_, i) => ({
    time: `2026-01-${String(i + 1).padStart(2, "0")}`,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 1000,
  }));

  it("calculates 20-period Simple Moving Average (SMA)", () => {
    const sma20 = calculateSma(dummyBars, 20);
    expect(sma20[0]).toBeNull();
    expect(sma20[18]).toBeNull();
    expect(sma20[19]).not.toBeNull();
    expect(typeof sma20[19]).toBe("number");
  });

  it("calculates 14-period RSI bounded between 0 and 100", () => {
    const rsi = calculateRsi(dummyBars, 14);
    expect(rsi[0]).toBeNull();
    expect(rsi[13]).toBeNull();

    const validRsi = rsi.filter((v): v is number => v !== null);
    expect(validRsi.length).toBeGreaterThan(0);
    for (const val of validRsi) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

describe("Macro Intelligence — Economic Calendar", () => {
  it("generates upcoming economic releases with impact and category tags", () => {
    const now = new Date();
    const events = generateInstitutionalCalendar(now, 30);

    expect(events.length).toBeGreaterThan(5);

    const categories = events.map((e) => e.category);
    expect(categories).toContain("INFLATION");
    expect(categories).toContain("CENTRAL BANK");
    expect(categories).toContain("LABOR");

    const criticalEvents = events.filter((e) => e.impact === "CRITICAL");
    expect(criticalEvents.length).toBeGreaterThan(0);
  });
});

describe("Chart Engine — Dynamic Bar Limits & Annual Aggregation", () => {
  it("computes accurate dynamic bar limits for intraday and macro resolutions", async () => {
    const { calculateEffectiveBarLimit } = await import("../lib/providers/chart");

    // 1m resolution scales up significantly for 1D, 5D, 1M, and ALL
    expect(calculateEffectiveBarLimit("1m", "1D", 60)).toBe(500);
    expect(calculateEffectiveBarLimit("1m", "5D", 120)).toBe(2500);
    expect(calculateEffectiveBarLimit("1m", "1M", 30)).toBe(8000);
    expect(calculateEffectiveBarLimit("1m", "ALL", 5000)).toBe(10000);

    // 1W and 1M resolution ranges
    expect(calculateEffectiveBarLimit("1W", "3M", 90)).toBe(13);
    expect(calculateEffectiveBarLimit("1W", "1Y", 252)).toBe(52);
    expect(calculateEffectiveBarLimit("1M", "3M", 90)).toBe(3);
    expect(calculateEffectiveBarLimit("1M", "1Y", 252)).toBe(12);

    // 1Y resolution bounds to historical annual count
    expect(calculateEffectiveBarLimit("1Y", "ALL", 5000)).toBe(100);
  });

  it("aggregates hourly bars into accurate 4-hour OHLCV candles", async () => {
    const { aggregateBarsByHour } = await import("../lib/providers/chart");

    const sampleHourlyBars: OhlcvBar[] = [
      { time: "2026-09-01 09:30", open: 100, high: 105, low: 99, close: 103, volume: 500 },
      { time: "2026-09-01 10:30", open: 103, high: 107, low: 102, close: 106, volume: 600 },
      { time: "2026-09-01 11:30", open: 106, high: 108, low: 104, close: 105, volume: 400 },
      { time: "2026-09-01 12:30", open: 105, high: 110, low: 103, close: 109, volume: 700 },
    ];

    const fourHour = aggregateBarsByHour(sampleHourlyBars, 4);
    expect(fourHour.length).toBe(1);
    expect(fourHour[0].open).toBe(100);
    expect(fourHour[0].high).toBe(110);
    expect(fourHour[0].low).toBe(99);
    expect(fourHour[0].close).toBe(109);
    expect(fourHour[0].volume).toBe(2200);
  });

  it("aggregates monthly bars across years into valid annual OHLCV bars", async () => {
    const { aggregateBarsByYear } = await import("../lib/providers/chart");

    const sampleMonthlyBars: OhlcvBar[] = [
      { time: "2023-01-01", open: 100, high: 110, low: 95, close: 105, volume: 1000 },
      { time: "2023-06-01", open: 105, high: 130, low: 102, close: 125, volume: 2000 },
      { time: "2023-12-01", open: 125, high: 140, low: 120, close: 135, volume: 1500 },
      { time: "2024-01-01", open: 135, high: 150, low: 130, close: 145, volume: 1200 },
      { time: "2024-12-01", open: 145, high: 160, low: 140, close: 155, volume: 1800 },
    ];

    const annual = aggregateBarsByYear(sampleMonthlyBars);
    expect(annual.length).toBe(2);

    // 2023 Annual Candle
    expect(annual[0].time).toBe("2023-01-01");
    expect(annual[0].open).toBe(100);
    expect(annual[0].high).toBe(140);
    expect(annual[0].low).toBe(95);
    expect(annual[0].close).toBe(135);
    expect(annual[0].volume).toBe(4500);

    // 2024 Annual Candle
    expect(annual[1].time).toBe("2024-01-01");
    expect(annual[1].open).toBe(135);
    expect(annual[1].high).toBe(160);
    expect(annual[1].low).toBe(130);
    expect(annual[1].close).toBe(155);
    expect(annual[1].volume).toBe(3000);
  });
});


