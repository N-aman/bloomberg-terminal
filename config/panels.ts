export interface PanelMeta {
  id: string;
  label: string;
  fullLabel: string;
  category: 'market' | 'research' | 'macro';
  tier: 'primary' | 'secondary' | 'tertiary';
}

export const PANEL_REGISTRY: PanelMeta[] = [
  { id: 'secf', label: 'SECF', fullLabel: 'Universal Security & Series Finder', category: 'market', tier: 'primary' },
  { id: 'chart', label: 'CHART', fullLabel: 'Interactive Candlestick Chart', category: 'market', tier: 'primary' },
  { id: 'dossier', label: 'DES', fullLabel: 'Company Dossier & Financial Snapshot', category: 'research', tier: 'secondary' },
  { id: 'analyst', label: 'ANR', fullLabel: 'Analyst Recommendations & Price Targets', category: 'research', tier: 'secondary' },
  { id: 'earnings', label: 'EARN', fullLabel: 'Quarterly Earnings Surprises', category: 'research', tier: 'secondary' },
  { id: 'movers', label: 'MOST', fullLabel: 'Market Movers & Volume Leaders', category: 'market', tier: 'primary' },
  { id: 'fxMatrix', label: 'FXC', fullLabel: 'FX Cross Matrix & Arbitrage Monitor', category: 'macro', tier: 'tertiary' },
  { id: 'commodities', label: 'COMM', fullLabel: 'Commodities & Energy Benchmarks', category: 'macro', tier: 'tertiary' },
  { id: 'dividend', label: 'DVD', fullLabel: 'Dividend Intelligence & Yield History', category: 'research', tier: 'tertiary' },
  { id: 'valuation', label: 'RV', fullLabel: 'Relative Valuation & Peer Comps', category: 'research', tier: 'tertiary' },
  { id: 'holders', label: 'HDS', fullLabel: 'Institutional Holdings & Fund Flows', category: 'research', tier: 'tertiary' },
  { id: 'fundamentals', label: 'FA', fullLabel: 'Financial Analysis & Balance Sheet', category: 'research', tier: 'secondary' },
  { id: 'options', label: 'OMON', fullLabel: 'Options Chain & Greeks', category: 'research', tier: 'secondary' },
  { id: 'calendar', label: 'ECO', fullLabel: 'Economic Release Calendar', category: 'macro', tier: 'tertiary' },
  { id: 'edgar', label: 'EDGAR', fullLabel: 'SEC Filings & Corporate Disclosures', category: 'research', tier: 'tertiary' },
  { id: 'indices', label: 'WEI', fullLabel: 'World Equity Indices', category: 'macro', tier: 'secondary' },
  { id: 'yield', label: 'YIELD', fullLabel: 'US Treasury Yield Curve', category: 'macro', tier: 'secondary' },
  { id: 'wirp', label: 'WIRP', fullLabel: 'Fed Rate Probabilities', category: 'macro', tier: 'tertiary' },
  { id: 'wbon', label: 'WBON', fullLabel: 'World Sovereign Bonds', category: 'macro', tier: 'tertiary' },
  { id: 'corr', label: 'CORR', fullLabel: 'Cross-Asset Pearson Correlation', category: 'macro', tier: 'tertiary' },
  { id: 'vol', label: 'VOL', fullLabel: 'Volatility Surface & Skew', category: 'macro', tier: 'tertiary' },
  { id: 'qr', label: 'QR', fullLabel: 'Time & Sales Real-Time Tape', category: 'market', tier: 'tertiary' },
  { id: 'sentiment', label: 'FNG', fullLabel: 'Crypto & Market Fear / Greed', category: 'macro', tier: 'tertiary' },
  { id: 'macro', label: 'ECON', fullLabel: 'FRED Macro Intelligence', category: 'macro', tier: 'tertiary' },
  { id: 'news', label: 'NEWS', fullLabel: 'Real-Time Financial Wire', category: 'market', tier: 'primary' },
];

export const PANEL_MAP: Record<string, PanelMeta> = Object.fromEntries(
  PANEL_REGISTRY.map((p) => [p.id, p])
);

export const ALL_PANEL_IDS: string[] = PANEL_REGISTRY.map((p) => p.id);

