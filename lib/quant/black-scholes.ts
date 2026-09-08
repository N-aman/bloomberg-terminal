/**
 * Quantitative Black-Scholes Option Pricing & Greeks Engine
 * Calculates theoretical Call/Put prices, Delta, Gamma, Theta, Vega, Rho,
 * and inverts market prices to solve for Implied Volatility (IV) via Newton-Raphson with Bisection fallback.
 */

// Standard normal cumulative distribution function approximation (Abramowitz & Stegun 7.1.26)
export function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * erf);
}

// Standard normal probability density function (PDF)
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type Greeks = {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // 1-day decay
  vega: number; // 1% change in vol
  rho: number;
};

/**
 * Calculates Black-Scholes Call and Put prices and Greeks
 * @param S Current underlying stock price
 * @param K Strike price
 * @param T Time to expiration in years (e.g. 30/365)
 * @param r Risk-free interest rate (e.g. 0.045 for 4.5%)
 * @param sigma Implied volatility (e.g. 0.25 for 25%)
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  T: number,
  r = 0.045,
  sigma = 0.30
): { call: Greeks; put: Greeks } {
  if (T <= 0.0001) {
    const callIntrinsic = Math.max(0, S - K);
    const putIntrinsic = Math.max(0, K - S);
    return {
      call: { price: callIntrinsic, delta: S >= K ? 1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
      put: { price: putIntrinsic, delta: S < K ? -1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
    };
  }

  const safeSigma = Math.max(0.001, sigma);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (safeSigma * safeSigma) / 2) * T) / (safeSigma * sqrtT);
  const d2 = d1 - safeSigma * sqrtT;

  const Nd1 = normalCdf(d1);
  const Nd2 = normalCdf(d2);
  const N_neg_d1 = normalCdf(-d1);
  const N_neg_d2 = normalCdf(-d2);
  const pdf_d1 = normalPdf(d1);

  const expDiscount = Math.exp(-r * T);

  // Prices
  const callPrice = Math.max(0, S * Nd1 - K * expDiscount * Nd2);
  const putPrice = Math.max(0, K * expDiscount * N_neg_d2 - S * N_neg_d1);

  // Common Greeks
  const gamma = pdf_d1 / (S * safeSigma * sqrtT);
  const vega = (S * sqrtT * pdf_d1) * 0.01; // 1% vol change

  // Call Greeks
  const callDelta = Nd1;
  const callTheta =
    (-((S * pdf_d1 * safeSigma) / (2 * sqrtT)) - r * K * expDiscount * Nd2) / 365;
  const callRho = (K * T * expDiscount * Nd2) * 0.01;

  // Put Greeks
  const putDelta = Nd1 - 1;
  const putTheta =
    (-((S * pdf_d1 * safeSigma) / (2 * sqrtT)) + r * K * expDiscount * N_neg_d2) / 365;
  const putRho = (-K * T * expDiscount * N_neg_d2) * 0.01;

  return {
    call: {
      price: Math.round(callPrice * 100) / 100,
      delta: Math.round(callDelta * 1000) / 1000,
      gamma: Math.round(gamma * 10000) / 10000,
      theta: Math.round(callTheta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
      rho: Math.round(callRho * 100) / 100,
    },
    put: {
      price: Math.round(putPrice * 100) / 100,
      delta: Math.round(putDelta * 1000) / 1000,
      gamma: Math.round(gamma * 10000) / 10000,
      theta: Math.round(putTheta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
      rho: Math.round(putRho * 100) / 100,
    },
  };
}

/**
 * Numerical Implied Volatility Solver
 * Inverts the Black-Scholes formula using Newton-Raphson with Vega derivative,
 * falling back to Bisection search for deep ITM/OTM strikes.
 *
 * @param targetPrice Observed market option price
 * @param S Current spot price
 * @param K Strike price
 * @param T Time to expiration in years
 * @param r Risk-free rate (e.g. 0.045)
 * @param type "call" | "put"
 * @returns Solved Implied Volatility (e.g. 0.285 for 28.5%)
 */
export function solveImpliedVolatility(
  targetPrice: number,
  S: number,
  K: number,
  T: number,
  r = 0.045,
  type: "call" | "put" = "call"
): number {
  if (targetPrice <= 0 || S <= 0 || K <= 0 || T <= 0.0001) return 0.20;

  // Intrinsic lower bound validation
  const discountFactor = Math.exp(-r * T);
  const intrinsic = type === "call" ? Math.max(0, S - K * discountFactor) : Math.max(0, K * discountFactor - S);
  if (targetPrice < intrinsic) {
    return 0.05;
  }

  // 1. Primary Method: Newton-Raphson
  let sigma = 0.30;
  const maxIterations = 25;
  const tolerance = 1e-4;

  for (let i = 0; i < maxIterations; i++) {
    const bs = calculateBlackScholes(S, K, T, r, sigma);
    const price = type === "call" ? bs.call.price : bs.put.price;
    const diff = price - targetPrice;

    if (Math.abs(diff) < tolerance) {
      return Math.round(sigma * 1000) / 1000;
    }

    // Vega in BlackScholes is per 1% = 0.01, so real derivative dPrice/dSigma = vega * 100
    const vegaReal = (type === "call" ? bs.call.vega : bs.put.vega) * 100;

    if (vegaReal < 1e-5) {
      // Near-zero vega: Newton-Raphson diverges, break to Bisection
      break;
    }

    const nextSigma = sigma - diff / vegaReal;
    if (nextSigma <= 0.001 || nextSigma > 5.0 || isNaN(nextSigma)) {
      // Out of bounds, switch to Bisection
      break;
    }

    sigma = nextSigma;
  }

  // 2. Fallback Method: Bisection (Guaranteed convergence)
  let low = 0.001;
  let high = 5.0;
  for (let i = 0; i < 35; i++) {
    const mid = (low + high) / 2;
    const bs = calculateBlackScholes(S, K, T, r, mid);
    const price = type === "call" ? bs.call.price : bs.put.price;
    const diff = price - targetPrice;

    if (Math.abs(diff) < tolerance || (high - low) < 1e-4) {
      return Math.round(mid * 1000) / 1000;
    }

    if (diff > 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.round(((low + high) / 2) * 1000) / 1000;
}

/**
 * Calculates Max Pain Price given strike contracts & open interest
 */
export function calculateMaxPain(
  strikes: { strike: number; callOi: number; putOi: number }[]
): number {
  if (strikes.length === 0) return 0;

  let minTotalLoss = Infinity;
  let maxPainStrike = strikes[0].strike;

  for (const target of strikes) {
    let totalLoss = 0;
    for (const option of strikes) {
      // Call holder profit (loss to writer)
      if (target.strike > option.strike) {
        totalLoss += (target.strike - option.strike) * option.callOi;
      }
      // Put holder profit (loss to writer)
      if (target.strike < option.strike) {
        totalLoss += (option.strike - target.strike) * option.putOi;
      }
    }

    if (totalLoss < minTotalLoss) {
      minTotalLoss = totalLoss;
      maxPainStrike = target.strike;
    }
  }

  return maxPainStrike;
}
