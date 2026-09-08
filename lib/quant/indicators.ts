/**
 * Quantitative Technical Indicators Engine
 * Mathematical functions for computing statistical indicators:
 * SMA, EMA, WMA, VWAP, Bollinger Bands, ATR, RSI, MACD, and Stochastic.
 */

export interface OhlcBarPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type OhlcDataPoint = OhlcBarPoint;

/**
 * Simple Moving Average (SMA)
 */
export function calculateSma(data: number[], period: number): (number | null)[] {
  if (period <= 0) return data.map(() => null);
  const result: (number | null)[] = [];
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) {
      sum -= data[i - period];
    }
    if (i >= period - 1) {
      result.push(sum / period);
    } else {
      result.push(null);
    }
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEma(data: number[], period: number): (number | null)[] {
  if (period <= 0 || data.length === 0) return data.map(() => null);
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;
  let seedSum = 0;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      seedSum += data[i];
      result.push(null);
    } else if (i === period - 1) {
      seedSum += data[i];
      prevEma = seedSum / period;
      result.push(prevEma);
    } else {
      prevEma = data[i] * k + prevEma! * (1 - k);
      result.push(prevEma);
    }
  }

  return result;
}

/**
 * Weighted Moving Average (WMA)
 */
export function calculateWma(data: number[], period: number): (number | null)[] {
  if (period <= 0) return data.map(() => null);
  const result: (number | null)[] = [];
  const denominator = (period * (period + 1)) / 2;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let weightedSum = 0;
      for (let j = 0; j < period; j++) {
        weightedSum += data[i - period + 1 + j] * (j + 1);
      }
      result.push(weightedSum / denominator);
    }
  }

  return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 * VWAP = sum(Typical Price * Volume) / sum(Volume)
 */
export function calculateVwap(bars: OhlcBarPoint[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    const vol = bar.volume && bar.volume > 0 ? bar.volume : 1;

    cumulativeTypicalVolume += typicalPrice * vol;
    cumulativeVolume += vol;

    result.push(cumulativeVolume > 0 ? cumulativeTypicalVolume / cumulativeVolume : typicalPrice);
  }

  return result;
}

/**
 * Bollinger Bands (BB)
 * Upper = SMA + stdDev * σ
 * Lower = SMA - stdDev * σ
 */
export interface BollingerBandsResult {
  time: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function calculateBollingerBands(
  bars: OhlcBarPoint[],
  period = 20,
  stdDev = 2.0
): BollingerBandsResult[] {
  const closes = bars.map((b) => b.close);
  const smaValues = calculateSma(closes, period);
  const result: BollingerBandsResult[] = [];

  for (let i = 0; i < bars.length; i++) {
    const sma = smaValues[i];
    if (sma === null || i < period - 1) {
      result.push({ time: bars[i].time, upper: null, middle: null, lower: null });
      continue;
    }

    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(closes[j] - sma, 2);
    }
    const standardDeviation = Math.sqrt(varianceSum / period);

    result.push({
      time: bars[i].time,
      upper: sma + stdDev * standardDeviation,
      middle: sma,
      lower: sma - stdDev * standardDeviation,
    });
  }

  return result;
}

/**
 * Average True Range (ATR)
 */
export function calculateAtr(
  bars: { high: number; low: number; close: number }[],
  period = 14
): (number | null)[] {
  if (bars.length === 0 || period <= 0) return bars.map(() => null);
  const trValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      trValues.push(bars[i].high - bars[i].low);
    } else {
      const tr = Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - bars[i - 1].close),
        Math.abs(bars[i].low - bars[i - 1].close)
      );
      trValues.push(tr);
    }
  }

  const result: (number | null)[] = [];
  let prevAtr: number | null = null;
  let seedSum = 0;

  for (let i = 0; i < trValues.length; i++) {
    if (i < period - 1) {
      seedSum += trValues[i];
      result.push(null);
    } else if (i === period - 1) {
      seedSum += trValues[i];
      prevAtr = seedSum / period;
      result.push(prevAtr);
    } else {
      prevAtr = (prevAtr! * (period - 1) + trValues[i]) / period;
      result.push(prevAtr);
    }
  }

  return result;
}

/**
 * Relative Strength Index (RSI) with Wilder's smoothing
 */
export function calculateRsi(data: number[], period = 14): (number | null)[] {
  if (data.length <= period || period <= 0) return data.map(() => null);
  const result: (number | null)[] = [null]; // 1st element has no diff

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sumGain = 0;
      let sumLoss = 0;
      for (let j = 0; j < period; j++) {
        sumGain += gains[j];
        sumLoss += losses[j];
      }
      avgGain = sumGain / period;
      avgLoss = sumLoss / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
    }
  }

  return result;
}

/**
 * Moving Average Convergence Divergence (MACD)
 */
export interface MacdResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function calculateMacd(
  data: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdResult[] {
  const fastEma = calculateEma(data, fastPeriod);
  const slowEma = calculateEma(data, slowPeriod);

  const macdLine: (number | null)[] = [];
  const validMacdValues: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      const val = fastEma[i]! - slowEma[i]!;
      macdLine.push(val);
      validMacdValues.push(val);
    } else {
      macdLine.push(null);
    }
  }

  const signalEma = calculateEma(validMacdValues, signalPeriod);
  const result: MacdResult[] = [];
  let signalIdx = 0;

  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null) {
      result.push({ macd: null, signal: null, histogram: null });
    } else {
      const sig = signalEma[signalIdx] ?? null;
      signalIdx++;
      const hist = sig !== null ? macdLine[i]! - sig : null;
      result.push({
        macd: macdLine[i],
        signal: sig,
        histogram: hist,
      });
    }
  }

  return result;
}

/**
 * Stochastic Oscillator (%K, %D)
 */
export interface StochasticResult {
  time: string;
  k: number | null;
  d: number | null;
}

export function calculateStochastic(
  bars: { time: string; high: number; low: number; close: number }[],
  periodK = 14,
  smoothK = 3,
  smoothD = 3
): StochasticResult[] {
  const rawK: (number | null)[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < periodK - 1) {
      rawK.push(null);
      continue;
    }

    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - periodK + 1; j <= i; j++) {
      if (bars[j].high > highestHigh) highestHigh = bars[j].high;
      if (bars[j].low < lowestLow) lowestLow = bars[j].low;
    }

    const range = highestHigh - lowestLow;
    if (range === 0) {
      rawK.push(50);
    } else {
      rawK.push(((bars[i].close - lowestLow) / range) * 100);
    }
  }

  const validK = rawK.filter((v): v is number => v !== null);
  const smoothedK = calculateSma(validK, smoothK);
  const validSmoothedK = smoothedK.filter((v): v is number => v !== null);
  const smoothedD = calculateSma(validSmoothedK, smoothD);

  const result: StochasticResult[] = [];
  let kIdx = 0;
  let dIdx = 0;

  for (let i = 0; i < bars.length; i++) {
    if (rawK[i] === null) {
      result.push({ time: bars[i].time, k: null, d: null });
    } else {
      const kVal = smoothedK[kIdx] ?? null;
      kIdx++;
      let dVal: number | null = null;
      if (kVal !== null) {
        dVal = smoothedD[dIdx] ?? null;
        dIdx++;
      }
      result.push({
        time: bars[i].time,
        k: kVal,
        d: dVal,
      });
    }
  }

  return result;
}

/**
 * Hull Moving Average (HMA)
 * HMA = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))
 */
export function calculateHma(data: number[], period = 9): (number | null)[] {
  if (period <= 1 || data.length < period) return data.map(() => null);

  const halfPeriod = Math.max(1, Math.round(period / 2));
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(period)));

  const wmaHalf = calculateWma(data, halfPeriod);
  const wmaFull = calculateWma(data, period);

  const diffSeries: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (wmaHalf[i] !== null && wmaFull[i] !== null) {
      diffSeries.push(2 * wmaHalf[i]! - wmaFull[i]!);
    } else {
      diffSeries.push(0);
    }
  }

  const hmaRaw = calculateWma(diffSeries, sqrtPeriod);
  return data.map((_, i) => (i < period + sqrtPeriod - 2 ? null : hmaRaw[i]));
}

/**
 * Supertrend Indicator Result
 */
export interface SupertrendResult {
  time: string;
  value: number | null;
  direction: "bullish" | "bearish" | null;
}

/**
 * Supertrend Indicator
 * ATR-based trailing stop and trend following strategy
 */
export function calculateSupertrend(
  bars: OhlcBarPoint[],
  period = 10,
  multiplier = 3.0
): SupertrendResult[] {
  if (bars.length === 0) return [];
  const atrValues = calculateAtr(bars, period);

  const result: SupertrendResult[] = [];
  let prevUpper = 0;
  let prevLower = 0;
  let prevTrend = 1;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const atr = atrValues[i];

    if (atr === null || i < period) {
      result.push({ time: bar.time, value: null, direction: null });
      continue;
    }

    const hl2 = (bar.high + bar.low) / 2;
    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > 0 && result[i - 1]?.value !== null) {
      const prevClose = bars[i - 1].close;
      if (basicUpper < prevUpper || prevClose > prevUpper) {
        finalUpper = basicUpper;
      } else {
        finalUpper = prevUpper;
      }

      if (basicLower > prevLower || prevClose < prevLower) {
        finalLower = basicLower;
      } else {
        finalLower = prevLower;
      }
    }

    let trend = prevTrend;
    if (trend === 1 && bar.close < finalLower) {
      trend = -1;
    } else if (trend === -1 && bar.close > finalUpper) {
      trend = 1;
    }

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = trend;

    result.push({
      time: bar.time,
      value: trend === 1 ? finalLower : finalUpper,
      direction: trend === 1 ? "bullish" : "bearish",
    });
  }

  return result;
}

/**
 * Donchian Channels
 */
export interface DonchianResult {
  time: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function calculateDonchianChannels(bars: OhlcBarPoint[], period = 20): DonchianResult[] {
  const result: DonchianResult[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      result.push({ time: bars[i].time, upper: null, middle: null, lower: null });
      continue;
    }
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > highest) highest = bars[j].high;
      if (bars[j].low < lowest) lowest = bars[j].low;
    }
    result.push({
      time: bars[i].time,
      upper: highest,
      middle: (highest + lowest) / 2,
      lower: lowest,
    });
  }
  return result;
}

/**
 * Keltner Channels
 */
export interface KeltnerResult {
  time: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function calculateKeltnerChannels(
  bars: OhlcBarPoint[],
  period = 20,
  multiplier = 1.5
): KeltnerResult[] {
  const closes = bars.map((b) => b.close);
  const emaValues = calculateEma(closes, period);
  const atrValues = calculateAtr(bars, period);

  const result: KeltnerResult[] = [];
  for (let i = 0; i < bars.length; i++) {
    const ema = emaValues[i];
    const atr = atrValues[i];
    if (ema === null || atr === null) {
      result.push({ time: bars[i].time, upper: null, middle: null, lower: null });
    } else {
      result.push({
        time: bars[i].time,
        upper: ema + multiplier * atr,
        middle: ema,
        lower: ema - multiplier * atr,
      });
    }
  }
  return result;
}

/**
 * Williams %R Oscillator
 */
export function calculateWilliamsR(bars: OhlcBarPoint[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > highest) highest = bars[j].high;
      if (bars[j].low < lowest) lowest = bars[j].low;
    }
    const range = highest - lowest;
    if (range === 0) {
      result.push(-50);
    } else {
      result.push(((highest - bars[i].close) / range) * -100);
    }
  }
  return result;
}

/**
 * Commodity Channel Index (CCI)
 */
export function calculateCci(bars: OhlcBarPoint[], period = 20): (number | null)[] {
  const typicalPrices = bars.map((b) => (b.high + b.low + b.close) / 3);
  const smaTp = calculateSma(typicalPrices, period);

  const result: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    const sma = smaTp[i];
    if (sma === null || i < period - 1) {
      result.push(null);
      continue;
    }
    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(typicalPrices[j] - sma);
    }
    meanDev = meanDev / period;
    if (meanDev === 0) {
      result.push(0);
    } else {
      result.push((typicalPrices[i] - sma) / (0.015 * meanDev));
    }
  }
  return result;
}

/**
 * Volume Moving Average
 */
export function calculateVolumeMa(bars: OhlcBarPoint[], period = 20): (number | null)[] {
  const volumes = bars.map((b) => b.volume || 0);
  return calculateSma(volumes, period);
}

