// Dedicated shared TypeScript data contracts for Bloomberg Terminal features

// WIRP / FED
export type FomcMeetingProbability = {
  date: string;
  daysUntil: number;
  currentBand: string;
  impliedRate: number;
  probHold: number;
  probCut25: number;
  probCut50: number;
  probHike25: number;
  consensusBias: "EASING" | "NEUTRAL" | "TIGHTENING";
};

export type FedRatesData = {
  targetUpper: number;
  targetLower: number;
  effectiveRate: number;
  sofr: number;
  nextMeetingDate: string;
  meetings: FomcMeetingProbability[];
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

// DVD / DIVIDENDS
export type DividendPayment = {
  exDate: string;
  amount: number;
  recordDate: string;
  payDate: string;
};

export type StockSplit = {
  date: string;
  ratio: string;
};

export type DividendData = {
  ticker: string;
  companyName: string;
  indicatedYield: number;
  trailingYield: number;
  annualRate: number;
  payoutRatio: number;
  fiveYearCagr: number;
  consecutiveYears: number;
  frequency: "quarterly" | "monthly" | "semi-annual" | "annual";
  splits: StockSplit[];
  history: DividendPayment[];
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

// RV / PEERS
export type PeerMetric = {
  ticker: string;
  name: string;
  price: number;
  marketCapB: number;
  peRatio: number;
  forwardPe: number;
  evEbitda: number;
  priceToSales: number;
  grossMarginPercent: number;
  operatingMarginPercent: number;
  revenueGrowthYoy: number;
  roePercent: number;
  isTarget?: boolean;
};

export type RelativeValuationData = {
  targetTicker: string;
  industry: string;
  peers: PeerMetric[];
  median: PeerMetric;
  average: PeerMetric;
  valuationAssessment: "PREMIUM" | "IN_LINE" | "DISCOUNT";
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

// WBON / WORLD BONDS
export type SovereignYield = {
  country: string;
  flag: string;
  currency: string;
  yield2Y: number;
  yield5Y: number;
  yield10Y: number;
  yield30Y: number;
  changeBps1D: number;
  spreadVsUS10Y: number;
  curveShape: "NORMAL" | "FLAT" | "INVERTED";
};

export type WorldBondsData = {
  asOf: string;
  benchmarks: SovereignYield[];
  spreadRankings: { country: string; spreadBps: number }[];
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

// CORR / CORRELATION
export type CorrelationMatrixData = {
  asOf: string;
  windowDays: number;
  symbols: string[];
  matrix: Record<string, Record<string, number>>;
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

// VOL / VOLATILITY
export type VolPoint = {
  strike: number;
  delta: number;
  impliedVol: number;
};

export type VolatilityData = {
  symbol: string;
  currentPrice: number;
  vixCls: number;
  realizedVol30D: number;
  impliedVol30D: number;
  volRiskPremium: number;
  regime: "LOW_VOL" | "NORMAL" | "ELEVATED" | "EXTREME";
  smileCurve: VolPoint[];
  history: { date: string; vix: number; realized: number }[];
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

// HDS / HOLDERS
export type InstitutionalHolder = {
  rank: number;
  holderName: string;
  sharesHeld: number;
  valueB: number;
  percentOut: number;
  changeQoQShares: number;
  changePercent: number;
  filingDate: string;
};

export type InsiderTransaction = {
  insiderName: string;
  title: string;
  transactionType: "BUY" | "SALE" | "OPTION EXERCISE";
  shares: number;
  pricePerShare: number;
  totalValue: number;
  date: string;
};

export type HoldersData = {
  ticker: string;
  companyName: string;
  institutionalOwnershipPercent: number;
  top10ConcentrationPercent: number;
  insiderOwnershipPercent: number;
  totalInstitutions: number;
  holders: InstitutionalHolder[];
  insiderTransactions: InsiderTransaction[];
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

