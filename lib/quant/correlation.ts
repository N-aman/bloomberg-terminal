/**
 * Mathematical quant functions for asset return correlations.
 * Per Bloomberg standards, correlations are computed on daily log returns:
 * r_t = ln(P_t / P_{t-1})
 */

export function calculateLogReturns(prices: number[]): number[] {
  if (!prices || prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    } else {
      returns.push(0);
    }
  }
  return returns;
}

export function calculateMean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);

  const meanX = calculateMean(xSlice);
  const meanY = calculateMean(ySlice);

  const stdX = calculateStdDev(xSlice, meanX);
  const stdY = calculateStdDev(ySlice, meanY);

  if (stdX === 0 || stdY === 0) return 0;

  let covariance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (xSlice[i] - meanX) * (ySlice[i] - meanY);
  }
  covariance /= n - 1;

  const corr = covariance / (stdX * stdY);
  return Math.max(-1, Math.min(1, parseFloat(corr.toFixed(4))));
}

export type CorrelationMatrixResult = {
  assets: string[];
  matrix: number[][]; // N x N
  windowDays: number;
};

export function buildCorrelationMatrix(
  assetPriceSeries: Record<string, number[]>,
  windowDays: number = 30
): CorrelationMatrixResult {
  const assets = Object.keys(assetPriceSeries);
  const logReturnsMap: Record<string, number[]> = {};

  for (const asset of assets) {
    const prices = assetPriceSeries[asset].slice(-windowDays - 1);
    logReturnsMap[asset] = calculateLogReturns(prices);
  }

  const matrix: number[][] = [];

  for (let i = 0; i < assets.length; i++) {
    const row: number[] = [];
    const assetA = assets[i];
    for (let j = 0; j < assets.length; j++) {
      if (i === j) {
        row.push(1.0);
      } else {
        const assetB = assets[j];
        const corr = calculatePearsonCorrelation(
          logReturnsMap[assetA] || [],
          logReturnsMap[assetB] || []
        );
        row.push(corr);
      }
    }
    matrix.push(row);
  }

  return {
    assets,
    matrix,
    windowDays,
  };
}

