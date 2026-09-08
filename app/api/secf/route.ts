import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { WORLD_CURRENCIES } from "@/lib/currencies";
import { fetchCompanyTickerMap, TOP_CIK_MAP } from "@/lib/providers/edgar";

export type SecurityItem = {
  symbol: string;
  name: string;
  assetClass: "EQUITY" | "CRYPTO" | "CURNCY" | "COMM" | "GOVT" | "MACRO";
  exchange: string;
  description: string;
  command: string;
};

const STATIC_SECURITIES: SecurityItem[] = [
  // Major Equities
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "EQUITY", exchange: "NASDAQ", description: "Consumer Electronics & Tech", command: "AAPL US EQUITY GP <GO>" },
  { symbol: "NVDA", name: "NVIDIA Corporation", assetClass: "EQUITY", exchange: "NASDAQ", description: "Semiconductors & AI Compute", command: "NVDA US EQUITY GP <GO>" },
  { symbol: "TSLA", name: "Tesla, Inc.", assetClass: "EQUITY", exchange: "NASDAQ", description: "Electric Vehicles & Clean Energy", command: "TSLA US EQUITY GP <GO>" },
  { symbol: "MSFT", name: "Microsoft Corporation", assetClass: "EQUITY", exchange: "NASDAQ", description: "Cloud Infrastructure & Software", command: "MSFT US EQUITY GP <GO>" },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetClass: "EQUITY", exchange: "NASDAQ", description: "E-Commerce & AWS Cloud", command: "AMZN US EQUITY GP <GO>" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)", assetClass: "EQUITY", exchange: "NASDAQ", description: "Search, Advertising & Cloud", command: "GOOGL US EQUITY GP <GO>" },
  { symbol: "META", name: "Meta Platforms Inc.", assetClass: "EQUITY", exchange: "NASDAQ", description: "Social Media & Metaverse", command: "META US EQUITY GP <GO>" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", assetClass: "EQUITY", exchange: "NYSE", description: "AI & Big Data Analytics", command: "PLTR US EQUITY GP <GO>" },
  { symbol: "AMD", name: "Advanced Micro Devices", assetClass: "EQUITY", exchange: "NASDAQ", description: "Semiconductors & Processors", command: "AMD US EQUITY GP <GO>" },
  { symbol: "INTC", name: "Intel Corporation", assetClass: "EQUITY", exchange: "NASDAQ", description: "Semiconductor Manufacturing", command: "INTC US EQUITY GP <GO>" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "EQUITY", exchange: "NYSE ARCA", description: "Benchmark S&P 500 Index ETF", command: "SPY US EQUITY GP <GO>" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: "EQUITY", exchange: "NASDAQ", description: "Nasdaq 100 Index Tracking ETF", command: "QQQ US EQUITY GP <GO>" },

  // Crypto
  { symbol: "BTCUSDT", name: "Bitcoin / Tether Spot", assetClass: "CRYPTO", exchange: "BINANCE", description: "Decentralized Digital Gold Benchmark", command: "BTC CRYPTO <GO>" },
  { symbol: "ETHUSDT", name: "Ethereum / Tether Spot", assetClass: "CRYPTO", exchange: "BINANCE", description: "Smart Contract Layer 1 Platform", command: "ETH CRYPTO <GO>" },
  { symbol: "SOLUSDT", name: "Solana / Tether Spot", assetClass: "CRYPTO", exchange: "BINANCE", description: "High-Throughput PoS Blockchain", command: "SOL CRYPTO <GO>" },
  { symbol: "BNBUSDT", name: "BNB / Tether Spot", assetClass: "CRYPTO", exchange: "BINANCE", description: "BNB Chain Utility Token", command: "BNB CRYPTO <GO>" },
  { symbol: "XRPUSDT", name: "XRP / Tether Spot", assetClass: "CRYPTO", exchange: "BINANCE", description: "Ripple Cross-Border Payment Asset", command: "XRP CRYPTO <GO>" },

  // Commodities
  { symbol: "CL1", name: "WTI Crude Oil Benchmark", assetClass: "COMM", exchange: "NYMEX", description: "West Texas Intermediate Crude Oil ($/bbl)", command: "CL1 COM <GO>" },
  { symbol: "BRENT", name: "Brent Crude Oil", assetClass: "COMM", exchange: "ICE", description: "Global Sweet Crude Benchmark ($/bbl)", command: "COMM OIL <GO>" },
  { symbol: "XAU", name: "Gold Spot Benchmark", assetClass: "COMM", exchange: "COMEX", description: "Physical Gold Bullion Spot ($/troy oz)", command: "XAU COM <GO>" },
  { symbol: "XAG", name: "Silver Spot Benchmark", assetClass: "COMM", exchange: "COMEX", description: "Physical Silver Spot ($/troy oz)", command: "COMM SILVER <GO>" },
  { symbol: "HG1", name: "Copper Benchmark", assetClass: "COMM", exchange: "COMEX", description: "High Grade Industrial Copper ($/lb)", command: "COMM COPPER <GO>" },
  { symbol: "NG1", name: "Natural Gas Benchmark", assetClass: "COMM", exchange: "NYMEX", description: "Henry Hub Natural Gas ($/MMBtu)", command: "COMM <GO>" },

  // Sovereign Bonds & Yields
  { symbol: "US10Y", name: "US 10-Year Treasury Benchmark", assetClass: "GOVT", exchange: "US TREASURY", description: "US Constant Maturity 10Y Benchmark", command: "US10Y GOVT <GO>" },
  { symbol: "US2Y", name: "US 2-Year Treasury Benchmark", assetClass: "GOVT", exchange: "US TREASURY", description: "US Constant Maturity 2Y Benchmark", command: "YIELD <GO>" },
  { symbol: "US30Y", name: "US 30-Year Treasury Benchmark", assetClass: "GOVT", exchange: "US TREASURY", description: "US Long Bond 30Y Benchmark", command: "YIELD <GO>" },
  { symbol: "DE10Y", name: "Germany 10-Year Bund", assetClass: "GOVT", exchange: "DEUTSCHE BUNDESBANK", description: "German Federal Sovereign Benchmark", command: "WBON <GO>" },
  { symbol: "UK10Y", name: "United Kingdom 10-Year Gilt", assetClass: "GOVT", exchange: "DMO", description: "UK Sovereign Debt Benchmark", command: "WBON <GO>" },
  { symbol: "JP10Y", name: "Japan 10-Year JGB", assetClass: "GOVT", exchange: "MOF JAPAN", description: "Japanese Government 10Y Bond", command: "WBON <GO>" },

  // Macro Economic Series (FRED)
  { symbol: "CPIAUCSL", name: "Consumer Price Index (CPI)", assetClass: "MACRO", exchange: "FRED / BLS", description: "US Headline Consumer Inflation YoY", command: "ECON CPI <GO>" },
  { symbol: "PCEPILFE", name: "Core PCE Price Index", assetClass: "MACRO", exchange: "FRED / BEA", description: "Fed's Preferred Inflation Target", command: "ECON PCE <GO>" },
  { symbol: "GDPC1", name: "Real Gross Domestic Product", assetClass: "MACRO", exchange: "FRED / BEA", description: "US Inflation-Adjusted GDP Output", command: "ECON GDP <GO>" },
  { symbol: "PAYEMS", name: "Total Nonfarm Payrolls", assetClass: "MACRO", exchange: "FRED / BLS", description: "US Monthly Employment Creation", command: "ECON PAYROLLS <GO>" },
  { symbol: "UNRATE", name: "Unemployment Rate", assetClass: "MACRO", exchange: "FRED / BLS", description: "US Headline Civilian Unemployment %", command: "ECON UNEMPLOYMENT <GO>" },
  { symbol: "FEDFUNDS", name: "Effective Federal Funds Rate", assetClass: "MACRO", exchange: "FRED / FED", description: "Volume-Weighted Overnight Interbank Rate", command: "WIRP <GO>" },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || searchParams.get("query") || "").trim().toUpperCase();
  const category = (searchParams.get("category") || "ALL").trim().toUpperCase();

  const CACHE_KEY = `secf:search:v1:${encodeURIComponent(q)}:${category}`;
  const cached = await getCached<{ query: string; results: SecurityItem[] }>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json(cached.value);
  }

  // Load all search candidates
  const allCandidates: SecurityItem[] = [...STATIC_SECURITIES];

  // Add world currencies
  for (const c of WORLD_CURRENCIES) {
    allCandidates.push({
      symbol: `${c.code}USD`,
      name: `${c.name} (${c.code})`,
      assetClass: "CURNCY",
      exchange: c.country || "FX SPOT",
      description: `${c.name} Foreign Exchange Rate`,
      command: `FX ${c.code} USD <GO>`,
    });
  }

  // Add dynamic public company tickers
  try {
    const tickerMap = await fetchCompanyTickerMap();
    for (const [sym, info] of Object.entries(tickerMap)) {
      if (!STATIC_SECURITIES.some((s) => s.symbol === sym)) {
        allCandidates.push({
          symbol: sym,
          name: info.name,
          assetClass: "EQUITY",
          exchange: "US SEC",
          description: `SEC Registered Corporation (CIK: ${info.cik})`,
          command: `${sym} US EQUITY GP <GO>`,
        });
      }
    }
  } catch {
    // Keep static list on error
  }

  // Filter candidates
  let filtered = allCandidates;

  if (category !== "ALL") {
    filtered = filtered.filter((item) => item.assetClass === category);
  }

  if (q) {
    filtered = filtered.filter(
      (item) =>
        item.symbol.toUpperCase().includes(q) ||
        item.name.toUpperCase().includes(q) ||
        item.description.toUpperCase().includes(q)
    );
  }

  // Rank matches: exact symbol match first, startsWith symbol second, name matches third
  filtered.sort((a, b) => {
    if (a.symbol === q) return -1;
    if (b.symbol === q) return 1;
    if (a.symbol.startsWith(q) && !b.symbol.startsWith(q)) return -1;
    if (!a.symbol.startsWith(q) && b.symbol.startsWith(q)) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  const topResults = filtered.slice(0, 50);

  const responsePayload = {
    query: q,
    category,
    total: topResults.length,
    results: topResults,
  };

  await setCached(CACHE_KEY, responsePayload, 300); // 5 min cache
  return NextResponse.json(responsePayload);
}
