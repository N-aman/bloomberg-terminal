import { describe, it, expect } from "vitest";
import {
  calculateSma,
  calculateEma,
  calculateWma,
  calculateHma,
  calculateVwap,
  calculateBollingerBands,
  calculateAtr,
  calculateSupertrend,
  calculateDonchianChannels,
  calculateKeltnerChannels,
  calculateRsi,
  calculateWilliamsR,
  calculateCci,
  calculateMacd,
  calculateStochastic,
  type OhlcDataPoint,
} from "../lib/quant/indicators";

describe("Quantitative Technical Indicators Suite", () => {
  const sampleBars: OhlcDataPoint[] = Array.from({ length: 40 }, (_, i) => ({
    time: `2026-08-${String(i + 1).padStart(2, "0")}`,
    open: 100 + i * 0.5,
    high: 102 + i * 0.5,
    low: 99 + i * 0.5,
    close: 101 + i * 0.5,
    volume: 10000 + i * 500,
  }));

  const sampleCloses = sampleBars.map((b) => b.close);

  it("calculates SMA accurately", () => {
    const sma20 = calculateSma(sampleCloses, 20);
    expect(sma20[0]).toBeNull();
    expect(sma20[18]).toBeNull();
    expect(sma20[19]).not.toBeNull();
    expect(typeof sma20[19]).toBe("number");
    expect(sma20[19]!).toBeGreaterThan(100);
  });

  it("calculates EMA with exponential smoothing", () => {
    const ema9 = calculateEma(sampleCloses, 9);
    expect(ema9[0]).toBeNull();
    expect(ema9[7]).toBeNull();
    expect(ema9[8]).not.toBeNull();
    expect(ema9[39]!).toBeGreaterThan(ema9[8]!);
  });

  it("calculates VWAP volume-weighted series", () => {
    const vwap = calculateVwap(sampleBars);
    expect(vwap.length).toBe(sampleBars.length);
    expect(vwap[0]).toBeCloseTo(100.67, 1);
    expect(vwap[39]!).toBeGreaterThan(100);
  });

  it("calculates Bollinger Bands (Upper, Middle, Lower)", () => {
    const bb = calculateBollingerBands(sampleBars, 20, 2.0);
    expect(bb.length).toBe(sampleBars.length);
    expect(bb[19].middle).not.toBeNull();
    expect(bb[19].upper!).toBeGreaterThan(bb[19].middle!);
    expect(bb[19].middle!).toBeGreaterThan(bb[19].lower!);
  });

  it("calculates Average True Range (ATR)", () => {
    const atr = calculateAtr(sampleBars, 14);
    expect(atr[13]).not.toBeNull();
    expect(atr[13]!).toBeGreaterThan(0);
  });

  it("calculates RSI bounded between 0 and 100", () => {
    const rsi = calculateRsi(sampleCloses, 14);
    const valid = rsi.filter((v): v is number => v !== null);
    expect(valid.length).toBeGreaterThan(0);
    for (const val of valid) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it("calculates MACD line, signal line, and histogram", () => {
    const macd = calculateMacd(sampleCloses, 12, 26, 9);
    expect(macd.length).toBe(sampleCloses.length);
    const last = macd[macd.length - 1];
    expect(last.macd).not.toBeNull();
    expect(last.signal).not.toBeNull();
    expect(last.histogram).not.toBeNull();
    expect(last.histogram).toBeCloseTo(last.macd! - last.signal!, 2);
  });

  it("calculates Stochastic Oscillator (%K, %D)", () => {
    const stoch = calculateStochastic(sampleBars, 14, 3, 3);
    expect(stoch.length).toBe(sampleBars.length);
    const last = stoch[stoch.length - 1];
    expect(last.k).not.toBeNull();
    expect(last.d).not.toBeNull();
    expect(last.k!).toBeGreaterThanOrEqual(0);
    expect(last.k!).toBeLessThanOrEqual(100);
  });

  it("calculates Hull Moving Average (HMA)", () => {
    const hma9 = calculateHma(sampleCloses, 9);
    expect(hma9.length).toBe(sampleCloses.length);
    const last = hma9[hma9.length - 1];
    expect(last).not.toBeNull();
    expect(typeof last).toBe("number");
  });

  it("calculates Supertrend trendline and direction", () => {
    const st = calculateSupertrend(sampleBars, 10, 3.0);
    expect(st.length).toBe(sampleBars.length);
    const last = st[st.length - 1];
    expect(last.value).not.toBeNull();
    expect(["bullish", "bearish"]).toContain(last.direction);
  });

  it("calculates Donchian Channels breakout bands", () => {
    const dc = calculateDonchianChannels(sampleBars, 20);
    expect(dc.length).toBe(sampleBars.length);
    const last = dc[dc.length - 1];
    expect(last.upper).not.toBeNull();
    expect(last.lower).not.toBeNull();
    expect(last.upper!).toBeGreaterThanOrEqual(last.lower!);
  });

  it("calculates Keltner Channels volatility envelope", () => {
    const kc = calculateKeltnerChannels(sampleBars, 20, 1.5);
    expect(kc.length).toBe(sampleBars.length);
    const last = kc[kc.length - 1];
    expect(last.upper).not.toBeNull();
    expect(last.middle).not.toBeNull();
    expect(last.lower).not.toBeNull();
    expect(last.upper!).toBeGreaterThan(last.lower!);
  });

  it("calculates Williams %R momentum oscillator", () => {
    const wr = calculateWilliamsR(sampleBars, 14);
    expect(wr.length).toBe(sampleBars.length);
    const last = wr[wr.length - 1];
    expect(last).not.toBeNull();
    expect(last!).toBeLessThanOrEqual(0);
    expect(last!).toBeGreaterThanOrEqual(-100);
  });

  it("calculates Commodity Channel Index (CCI)", () => {
    const cci = calculateCci(sampleBars, 20);
    expect(cci.length).toBe(sampleBars.length);
    const last = cci[cci.length - 1];
    expect(last).not.toBeNull();
    expect(typeof last).toBe("number");
  });
});

