/**
 * Bloomberg Verified Security Catalog & Multi-Tier Scoring Database.
 * Strictly closed universe — zero arbitrary regex hallucination.
 * Every asset is mapped to an AssetTier (1 = Mega-Cap/Benchmark, 2 = High-Volume, 3 = Broad Market).
 */

export type AssetTier = 1 | 2 | 3;

export type VerifiedEquity = {
  ticker: string;
  name: string;
  tier: AssetTier;
};

export type VerifiedCrypto = {
  symbol: string;
  name: string;
  tier: AssetTier;
};

export type VerifiedIndex = {
  ticker: string;
  name: string;
  tier: AssetTier;
};

export type VerifiedGovt = {
  ticker: string;
  name: string;
  tier: AssetTier;
};

export type VerifiedCurrency = {
  pair: string;
  name: string;
  tier: AssetTier;
};

export type VerifiedCommodity = {
  ticker: string;
  name: string;
  tier: AssetTier;
};

// ==========================================
// 1. VERIFIED US EQUITIES & ETFS (~120+)
// ==========================================
export const VERIFIED_EQUITIES: VerifiedEquity[] = [
  // Tier 1: Mega-Cap Tech, Trillion-Dollar Issuers & Core Benchmark ETFs
  { ticker: "AAPL", name: "Apple Inc.", tier: 1 },
  { ticker: "NVDA", name: "NVIDIA Corp.", tier: 1 },
  { ticker: "MSFT", name: "Microsoft Corp.", tier: 1 },
  { ticker: "AMZN", name: "Amazon.com Inc.", tier: 1 },
  { ticker: "GOOGL", name: "Alphabet Inc. (Class A)", tier: 1 },
  { ticker: "GOOG", name: "Alphabet Inc. (Class C)", tier: 1 },
  { ticker: "META", name: "Meta Platforms Inc.", tier: 1 },
  { ticker: "TSLA", name: "Tesla Inc.", tier: 1 },
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", tier: 1 },
  { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", tier: 1 },
  { ticker: "AMD", name: "Advanced Micro Devices", tier: 1 },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", tier: 1 },
  { ticker: "V", name: "Visa Inc.", tier: 1 },
  { ticker: "WMT", name: "Walmart Inc.", tier: 1 },
  { ticker: "LLY", name: "Eli Lilly & Co.", tier: 1 },

  // Tier 2: High-Volume Movers, Retail Favorites & Liquid Large-Caps
  { ticker: "BRK", name: "Berkshire Hathaway Inc.", tier: 2 },
  { ticker: "PLTR", name: "Palantir Technologies", tier: 2 },
  { ticker: "COIN", name: "Coinbase Global Inc.", tier: 2 },
  { ticker: "SOFI", name: "SoFi Technologies", tier: 2 },
  { ticker: "GME", name: "GameStop Corp.", tier: 2 },
  { ticker: "SMCI", name: "Super Micro Computer", tier: 2 },
  { ticker: "INTC", name: "Intel Corp.", tier: 2 },
  { ticker: "NFLX", name: "Netflix Inc.", tier: 2 },
  { ticker: "BAC", name: "Bank of America Corp.", tier: 2 },
  { ticker: "DIS", name: "Walt Disney Co.", tier: 2 },
  { ticker: "TSM", name: "Taiwan Semiconductor Mfg", tier: 2 },
  { ticker: "BABA", name: "Alibaba Group Holding", tier: 2 },
  { ticker: "CRM", name: "Salesforce Inc.", tier: 2 },
  { ticker: "ORCL", name: "Oracle Corp.", tier: 2 },
  { ticker: "UBER", name: "Uber Technologies Inc.", tier: 2 },
  { ticker: "UNH", name: "UnitedHealth Group", tier: 2 },
  { ticker: "XOM", name: "Exxon Mobil Corp.", tier: 2 },
  { ticker: "JNJ", name: "Johnson & Johnson", tier: 2 },
  { ticker: "PG", name: "Procter & Gamble Co.", tier: 2 },
  { ticker: "HD", name: "Home Depot Inc.", tier: 2 },
  { ticker: "MA", name: "Mastercard Inc.", tier: 2 },
  { ticker: "COST", name: "Costco Wholesale Corp.", tier: 2 },
  { ticker: "ABBV", name: "AbbVie Inc.", tier: 2 },
  { ticker: "CVX", name: "Chevron Corp.", tier: 2 },
  { ticker: "MRK", name: "Merck & Co. Inc.", tier: 2 },
  { ticker: "PEP", name: "PepsiCo Inc.", tier: 2 },
  { ticker: "KO", name: "Coca-Cola Co.", tier: 2 },
  { ticker: "ADBE", name: "Adobe Inc.", tier: 2 },
  { ticker: "QCOM", name: "Qualcomm Inc.", tier: 2 },
  { ticker: "IBM", name: "International Business Machines", tier: 2 },
  { ticker: "ARM", name: "Arm Holdings plc", tier: 2 },
  { ticker: "RIVN", name: "Rivian Automotive Inc.", tier: 2 },
  { ticker: "SNOW", name: "Snowflake Inc.", tier: 2 },
  { ticker: "PANW", name: "Palo Alto Networks", tier: 2 },
  { ticker: "GS", name: "Goldman Sachs Group", tier: 2 },
  { ticker: "MS", name: "Morgan Stanley", tier: 2 },
  { ticker: "BLK", name: "BlackRock Inc.", tier: 2 },
  { ticker: "SCHW", name: "Charles Schwab Corp.", tier: 2 },
  { ticker: "CAT", name: "Caterpillar Inc.", tier: 2 },
  { ticker: "GE", name: "General Electric Co.", tier: 2 },

  // Tier 3: Broad US Universe & Large/Mid-Cap Growth
  { ticker: "ACN", name: "Accenture plc", tier: 3 },
  { ticker: "CSCO", name: "Cisco Systems Inc.", tier: 3 },
  { ticker: "TXN", name: "Texas Instruments Inc.", tier: 3 },
  { ticker: "AMAT", name: "Applied Materials Inc.", tier: 3 },
  { ticker: "NOW", name: "ServiceNow Inc.", tier: 3 },
  { ticker: "INTU", name: "Intuit Inc.", tier: 3 },
  { ticker: "ISRG", name: "Intuitive Surgical Inc.", tier: 3 },
  { ticker: "BKNG", name: "Booking Holdings Inc.", tier: 3 },
  { ticker: "MU", name: "Micron Technology Inc.", tier: 3 },
  { ticker: "AVGO", name: "Broadcom Inc.", tier: 3 },
  { ticker: "MDLZ", name: "Mondelez International", tier: 3 },
  { ticker: "LRCX", name: "Lam Research Corp.", tier: 3 },
  { ticker: "ADI", name: "Analog Devices Inc.", tier: 3 },
  { ticker: "KLAC", name: "KLA Corp.", tier: 3 },
  { ticker: "REGN", name: "Regeneron Pharmaceuticals", tier: 3 },
  { ticker: "VRTX", name: "Vertex Pharmaceuticals", tier: 3 },
  { ticker: "PYPL", name: "PayPal Holdings Inc.", tier: 3 },
  { ticker: "SQ", name: "Block Inc.", tier: 3 },
  { ticker: "SHOP", name: "Shopify Inc.", tier: 3 },
  { ticker: "HOOD", name: "Robinhood Markets", tier: 3 },
  { ticker: "MSTR", name: "MicroStrategy Inc.", tier: 3 },
  { ticker: "MARA", name: "MARA Holdings Inc.", tier: 3 },
  { ticker: "RIOT", name: "Riot Platforms Inc.", tier: 3 },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", tier: 3 },
  { ticker: "DIA", name: "SPDR Dow Jones Industrial Average", tier: 3 },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", tier: 3 },
];

// ==========================================
// 2. VERIFIED CRYPTOCURRENCIES (~25+)
// ==========================================
export const VERIFIED_CRYPTOS: VerifiedCrypto[] = [
  // Tier 1: Dominant Liquidity & Institutional Assets
  { symbol: "BTC", name: "Bitcoin", tier: 1 },
  { symbol: "ETH", name: "Ethereum", tier: 1 },
  { symbol: "SOL", name: "Solana", tier: 1 },
  { symbol: "BNB", name: "BNB", tier: 1 },
  { symbol: "XRP", name: "XRP", tier: 1 },
  { symbol: "DOGE", name: "Dogecoin", tier: 1 },

  // Tier 2: Top 20 Layer 1s, DeFi & High-Velocity Memes
  { symbol: "ADA", name: "Cardano", tier: 2 },
  { symbol: "AVAX", name: "Avalanche", tier: 2 },
  { symbol: "DOT", name: "Polkadot", tier: 2 },
  { symbol: "LINK", name: "Chainlink", tier: 2 },
  { symbol: "SUI", name: "Sui Network", tier: 2 },
  { symbol: "PEPE", name: "Pepe", tier: 2 },
  { symbol: "NEAR", name: "NEAR Protocol", tier: 2 },
  { symbol: "MATIC", name: "Polygon", tier: 2 },
  { symbol: "POL", name: "Polygon Ecosystem", tier: 2 },
  { symbol: "UNI", name: "Uniswap", tier: 2 },
  { symbol: "LTC", name: "Litecoin", tier: 2 },
  { symbol: "ATOM", name: "Cosmos", tier: 2 },

  // Tier 3: Extended Tradeable Universe
  { symbol: "SHIB", name: "Shiba Inu", tier: 3 },
  { symbol: "APT", name: "Aptos", tier: 3 },
  { symbol: "ARB", name: "Arbitrum", tier: 3 },
  { symbol: "OP", name: "Optimism", tier: 3 },
  { symbol: "FET", name: "Artificial Superintelligence", tier: 3 },
  { symbol: "RENDER", name: "Render", tier: 3 },
  { symbol: "TAO", name: "Bittensor", tier: 3 },
  { symbol: "INJ", name: "Injective", tier: 3 },
];

// ==========================================
// 3. VERIFIED WORLD INDICES
// ==========================================
export const VERIFIED_INDICES: VerifiedIndex[] = [
  { ticker: "SPX", name: "S&P 500 Index", tier: 1 },
  { ticker: "NDX", name: "Nasdaq 100 Index", tier: 1 },
  { ticker: "VIX", name: "CBOE Volatility Index", tier: 1 },
  { ticker: "INDU", name: "Dow Jones Industrial Average", tier: 1 },
  { ticker: "DJI", name: "Dow Jones Industrial Average", tier: 1 },
  { ticker: "RUT", name: "Russell 2000 Index", tier: 2 },
  { ticker: "FTSE", name: "FTSE 100 (London)", tier: 2 },
  { ticker: "DAX", name: "DAX 40 (Frankfurt)", tier: 2 },
  { ticker: "N225", name: "Nikkei 225 (Tokyo)", tier: 2 },
  { ticker: "HSI", name: "Hang Seng Index (Hong Kong)", tier: 2 },
  { ticker: "STOXX50", name: "Euro Stoxx 50", tier: 2 },
  { ticker: "CAC", name: "CAC 40 (Paris)", tier: 2 },
];

// ==========================================
// 4. VERIFIED SOVEREIGN DEBT / YIELD CURVE
// ==========================================
export const VERIFIED_GOVT: VerifiedGovt[] = [
  { ticker: "US10Y", name: "US 10-Year Benchmark Treasury Note", tier: 1 },
  { ticker: "US2Y", name: "US 2-Year Benchmark Treasury Note", tier: 1 },
  { ticker: "US30Y", name: "US 30-Year Benchmark Treasury Bond", tier: 1 },
  { ticker: "US3M", name: "US 3-Month Benchmark Treasury Bill", tier: 2 },
  { ticker: "US5Y", name: "US 5-Year Benchmark Treasury Note", tier: 2 },
  { ticker: "US1M", name: "US 1-Month Benchmark Treasury Bill", tier: 3 },
  { ticker: "US6M", name: "US 6-Month Benchmark Treasury Bill", tier: 3 },
];

// ==========================================
// 5. VERIFIED CURRENCIES / FX PAIRS
// ==========================================
export const VERIFIED_CURRENCIES: VerifiedCurrency[] = [
  { pair: "EURUSD", name: "Euro / US Dollar", tier: 1 },
  { pair: "USDJPY", name: "US Dollar / Japanese Yen", tier: 1 },
  { pair: "GBPUSD", name: "British Pound / US Dollar", tier: 1 },
  { pair: "USDINR", name: "US Dollar / Indian Rupee", tier: 1 },
  { pair: "USDCAD", name: "US Dollar / Canadian Dollar", tier: 2 },
  { pair: "AUDUSD", name: "Australian Dollar / US Dollar", tier: 2 },
  { pair: "USDCHF", name: "US Dollar / Swiss Franc", tier: 2 },
  { pair: "NZDUSD", name: "New Zealand Dollar / US Dollar", tier: 2 },
  { pair: "EURGBP", name: "Euro / British Pound", tier: 2 },
  { pair: "EURJPY", name: "Euro / Japanese Yen", tier: 2 },
];

// ==========================================
// 6. VERIFIED COMMODITIES & ENERGY BENCHMARKS
// ==========================================
export const VERIFIED_COMMODITIES: VerifiedCommodity[] = [
  { ticker: "CL1", name: "Crude Oil WTI Spot", tier: 1 },
  { ticker: "CRUDE", name: "Crude Oil (alias for CL1)", tier: 1 },
  { ticker: "OIL", name: "Crude Oil (alias for CL1)", tier: 1 },
  { ticker: "BRENT", name: "Brent Crude Oil", tier: 1 },
  { ticker: "XAU", name: "Gold Spot ($/oz)", tier: 1 },
  { ticker: "GOLD", name: "Gold Spot (alias for XAU)", tier: 1 },
  { ticker: "XAG", name: "Silver Spot ($/oz)", tier: 2 },
  { ticker: "SILVER", name: "Silver Spot (alias for XAG)", tier: 2 },
  { ticker: "NG1", name: "Natural Gas (Henry Hub)", tier: 2 },
  { ticker: "GAS", name: "Natural Gas (alias for NG1)", tier: 2 },
  { ticker: "COPPER", name: "Copper Grade A", tier: 2 },
];

// ==========================================
// 7. O(1) LOOKUP SETS FOR STRICT VALIDATION
// ==========================================
export const KNOWN_EQUITY_SET = new Set(VERIFIED_EQUITIES.map((e) => e.ticker));
export const KNOWN_CRYPTO_SET = new Set(VERIFIED_CRYPTOS.map((c) => c.symbol));
export const KNOWN_INDEX_SET = new Set(VERIFIED_INDICES.map((i) => i.ticker));
export const KNOWN_GOVT_SET = new Set(VERIFIED_GOVT.map((g) => g.ticker));
export const KNOWN_CURRENCY_SET = new Set(VERIFIED_CURRENCIES.map((c) => c.pair));
export const KNOWN_COMMODITY_SET = new Set(VERIFIED_COMMODITIES.map((m) => m.ticker));
