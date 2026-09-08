/**
 * Command registry, parsing, and history helpers for the Bloomberg Terminal command line.
 * Pure TypeScript — no React or JSX dependencies.
 */

import {
  VERIFIED_EQUITIES,
  VERIFIED_CRYPTOS,
  VERIFIED_INDICES,
  VERIFIED_GOVT,
  VERIFIED_CURRENCIES,
  VERIFIED_COMMODITIES,
  KNOWN_EQUITY_SET,
  KNOWN_CRYPTO_SET,
  KNOWN_INDEX_SET,
  KNOWN_GOVT_SET,
  KNOWN_CURRENCY_SET,
  KNOWN_COMMODITY_SET,
} from "./symbols";

export type CommandDef = {
  name: string;
  args?: string;
  description: string;
};

export const COMMANDS: CommandDef[] = [
  // Bloomberg Multi-Token Syntax
  { name: "AAPL US EQUITY GP", description: "Bloomberg: Candlestick chart for Apple (GP = Graphical Price)" },
  { name: "AAPL US EQUITY FA", description: "Bloomberg: Fundamental statement matrix for Apple (FA = Financial Analysis)" },
  { name: "AAPL US EQUITY OMON", description: "Bloomberg: Options chain & Greeks for Apple (OMON = Option Monitor)" },
  { name: "AAPL US EQUITY SEC", args: "[FORM]", description: "Bloomberg: SEC corporate filings (e.g. 10-K, 10-Q, 8-K)" },
  { name: "BTC CRYPTO", args: "[FUNCTION]", description: "Bloomberg: Real-time crypto order book (or GP for chart)" },
  { name: "EURUSD CURNCY", description: "Bloomberg: Currency exchange rate & cross-rate calculator" },
  { name: "US10Y GOVT", description: "Bloomberg: US Treasury benchmark yield curve" },
  { name: "SPX INDEX", description: "Bloomberg: S&P 500 Index & World Equity Indices (WEI)" },
  { name: "NDX INDEX", description: "Bloomberg: Nasdaq 100 Index & World Equity Indices" },
  { name: "VIX INDEX", description: "Bloomberg: CBOE Volatility Index" },
  { name: "CL1 COM", description: "Bloomberg: WTI Crude Oil Benchmark" },
  { name: "XAU COM", description: "Bloomberg: Gold Spot Benchmark ($/oz)" },
  { name: "TOP", args: "[CHANNEL]", description: "Bloomberg: Top market-moving news headlines (e.g. TOP TECH, TOP FX)" },

  // Tier 1 Bloomberg Analytical Commands
  { name: "DES", args: "[TICKER]", description: "Company Description & Executive Dossier (e.g. DES AAPL, DES NVDA)" },
  { name: "ANR", args: "[TICKER]", description: "Analyst Consensus Recommendations & Price Targets (e.g. ANR AAPL)" },
  { name: "EARN", args: "[TICKER]", description: "Quarterly Earnings History, Surprises & Beat/Miss Tracker (e.g. EARN NVDA)" },
  { name: "MOST", description: "Market Movers, Top Gainers, Losers & Volume Leaders across US Equities & Cryptos" },
  { name: "MOV", description: "Market Movers (alias for MOST)" },
  { name: "FXC", description: "8x8 Foreign Exchange Cross-Rate Matrix (USD, EUR, GBP, JPY, CHF, CAD, AUD, INR)" },
  { name: "COMM", args: "[QUERY]", description: "Global Commodities Benchmark Matrix (e.g. COMM, COMM GOLD, COMM OIL)" },
  { name: "DVD", args: "[TICKER]", description: "Dividend Intelligence, Yields, Payout Ratio & Split History (e.g. DVD AAPL, DVD JNJ)" },
  { name: "RV", args: "[TICKER]", description: "Relative Valuation & Peer Comps Matrix (e.g. RV AAPL, RV NVDA)" },
  { name: "WIRP", description: "World Interest Rate Probabilities & FOMC Policy Target Rate (alias FED)" },
  { name: "FED", description: "FOMC Policy Target Rate & Meeting Probabilities (alias for WIRP)" },
  { name: "WBON", description: "World Sovereign Bond Yields & 10Y Benchmark Spreads (alias BOND)" },
  { name: "BOND", description: "World Sovereign Bond Benchmark Matrix (alias for WBON)" },
  { name: "CORR", description: "Multi-Asset Rolling Pearson Correlation Matrix (e.g. SPY, QQQ, BTC, GLD, USO)" },
  { name: "VOL", description: "CBOE VIX Index, Volatility Surface & Implied Volatility Smile" },
  { name: "VIX", description: "CBOE Volatility Index & Term Structure (alias for VOL)" },
  { name: "HDS", args: "[TICKER]", description: "Institutional 13F Holders & Form 4 Insider Transactions (e.g. HDS AAPL, HDS NVDA)" },
  { name: "HOLDERS", args: "[TICKER]", description: "Institutional Holders (alias for HDS)" },
  { name: "QR", args: "[SYMBOL]", description: "Quick Quote & Real-Time Time & Sales Trade Tape (e.g. QR BTCUSDT, QR AAPL)" },
  { name: "TRADES", args: "[SYMBOL]", description: "Time & Sales Real-Time Trade Tape (alias for QR)" },
  { name: "SECF", args: "[QUERY]", description: "Universal Security & Economic Series Search across all asset classes" },
  { name: "FIND", args: "[QUERY]", description: "Security Finder (alias for SECF)" },

  // Direct Shortcut & Alias Commands
  { name: "CHART",   args: "[SYMBOL]",         description: "Technical Candlestick & OHLCV chart with SMA/RSI (e.g. CHART AAPL, CHART BTCUSDT)" },
  { name: "G",       args: "[SYMBOL]",         description: "Technical Candlestick & OHLCV chart (alias for GP)" },
  { name: "GP",      args: "[SYMBOL]",         description: "Graphical Price chart (e.g. GP AAPL)" },
  { name: "FA",      args: "[TICKER]",         description: "SEC Financial Analysis & Statement Matrix (e.g. FA AAPL, FA NVDA)" },
  { name: "FINANCIALS", args: "[TICKER]",      description: "Financial Statements matrix (alias)" },
  { name: "OMON",    args: "[SYMBOL]",         description: "Options Chain Monitor with Black-Scholes Greeks (e.g. OMON AAPL, OMON SPY)" },
  { name: "OPTIONS", args: "[SYMBOL]",         description: "Options Chain Monitor (alias)" },
  { name: "ECO",     description: "FRED Macroeconomic Release Calendar (FOMC, CPI, NFP, GDP)" },
  { name: "CALENDAR",description: "FRED Economic Calendar (alias)" },
  { name: "EDGAR",   args: "[TICKER] [FORM]",  description: "SEC EDGAR corporate filings (e.g. EDGAR AAPL, EDGAR NVDA 10-K)" },
  { name: "FILINGS", args: "[TICKER]",         description: "SEC EDGAR corporate filings (alias)" },
  { name: "SEC",     args: "[TICKER] [FORM]",  description: "SEC EDGAR corporate filings (e.g. SEC AAPL)" },
  { name: "10-K",    args: "[TICKER]",         description: "Annual reports from SEC EDGAR" },
  { name: "10-Q",    args: "[TICKER]",         description: "Quarterly reports from SEC EDGAR" },
  { name: "8-K",     args: "[TICKER]",         description: "Current material events & earnings reports from SEC" },
  { name: "STOCK",   args: "[TICKER]",         description: "Open real-time US Equity order book (e.g. STOCK AAPL, STOCK NVDA)" },
  { name: "BOOK",    args: "[SYMBOL]",         description: "Open crypto or stock order book (e.g. BOOK BTCUSDT, BOOK TSLA)" },
  { name: "NEWS",    args: "[QUERY]",          description: "Filter news headlines" },
  { name: "ECON",    args: "[TERM]",           description: "Search FRED economic series" },
  { name: "WEI",     args: "[FROM] [TO]",      description: "World equity indices, FX, and crypto" },
  { name: "FX",      args: "[FROM] [TO]",      description: "Exchange rate of any 2 currencies (e.g. FX EUR USD, FX GBP/JPY)" },
  { name: "YIELD",   description: "US Treasury yield curve" },
  { name: "CURVE",   description: "US Treasury yield curve (alias)" },
  { name: "FNG",     description: "Crypto Fear & Greed Index" },
  { name: "SENT",    description: "Crypto Fear & Greed Index (alias)" },
  { name: "HELP",    description: "List all commands" },
];

export type CommandResult =
  | { command: "CHART";   symbol: string }
  | { command: "FA";      ticker: string }
  | { command: "OMON";    symbol: string }
  | { command: "ECO" }
  | { command: "NEWS";    query: string }
  | { command: "ECON";    query: string }
  | { command: "WEI";     from?: string; to?: string }
  | { command: "FX";      from: string;  to: string }
  | { command: "EDGAR";   ticker: string; form?: string }
  | { command: "STOCK";   symbol: string }
  | { command: "BOOK";    symbol: string }
  | { command: "YIELD" }
  | { command: "FNG" }
  | { command: "HELP" }
  | { command: "DES";     ticker: string }
  | { command: "ANR";     ticker: string }
  | { command: "EARN";    ticker: string }
  | { command: "MOST" }
  | { command: "FXC" }
  | { command: "COMM"; query?: string }
  | { command: "DVD"; ticker: string }
  | { command: "RV"; ticker: string }
  | { command: "WIRP" }
  | { command: "WBON" }
  | { command: "CORR" }
  | { command: "VOL" }
  | { command: "HDS"; ticker: string }
  | { command: "QR"; symbol: string }
  | { command: "TOP"; channel?: string; query?: string }
  | { command: "SECF"; query?: string }
  | { command: "UNKNOWN"; input: string };

function parseCurrencyPair(args: string): { from: string; to: string } {
  const clean = args.trim().toUpperCase().replace(/[\/\-_]/g, " ");
  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return { from: parts[0], to: parts[1] };
  }
  if (parts.length === 1) {
    const single = parts[0];
    if (single.length === 6) {
      // e.g. EURUSD -> EUR, USD
      return { from: single.slice(0, 3), to: single.slice(3) };
    }
    return { from: single, to: "" };
  }
  return { from: "USD", to: "" };
}

const ASSET_CLASSES = new Set(["EQUITY", "CRYPTO", "CURNCY", "GOVT", "COM", "INDEX"]);

export function parseCommand(raw: string): CommandResult {
  const normalized = raw.trim();
  if (!normalized) {
    return { command: "UNKNOWN", input: "" };
  }

  // Strip trailing <GO> or GO (case-insensitive) if preceded by tokens or brackets
  let clean = normalized;
  const goMatch = clean.match(/^(.*?)(?:\s*<GO>|\s+GO)$/i);
  if (goMatch && goMatch[1].trim().length > 0) {
    clean = goMatch[1].trim();
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { command: "UNKNOWN", input: normalized };
  }

  const upperTokens = tokens.map((t) => t.toUpperCase());

  // Check if any token matches an asset class keyword: <TICKER> [<MARKET>] <ASSET_CLASS> [<FUNCTION>]
  const assetClassIdx = upperTokens.findIndex((t) => ASSET_CLASSES.has(t));

  if (assetClassIdx !== -1) {
    const assetClass = upperTokens[assetClassIdx];
    const prefixTokens = upperTokens.slice(0, assetClassIdx);
    const funcTokens = upperTokens.slice(assetClassIdx + 1);

    // Primary ticker is the first prefix token (e.g. "AAPL" from "AAPL US EQUITY")
    const ticker = prefixTokens[0] || (assetClass === "CRYPTO" ? "BTC" : "AAPL");
    const func = funcTokens[0] || "";

    switch (assetClass) {
      case "EQUITY": {
        switch (func) {
          case "GP":
          case "G":
          case "CHART":
            return { command: "CHART", symbol: ticker };
          case "FA":
          case "FINANCIALS":
            return { command: "FA", ticker };
          case "OMON":
          case "OPTIONS":
          case "OPT":
            return { command: "OMON", symbol: ticker };
          case "SEC":
          case "EDGAR":
          case "FILINGS": {
            const form = funcTokens[1] || "ALL";
            return { command: "EDGAR", ticker, form };
          }
          case "10-K":
          case "10K":
            return { command: "EDGAR", ticker, form: "10-K" };
          case "10-Q":
          case "10Q":
            return { command: "EDGAR", ticker, form: "10-Q" };
          case "8-K":
          case "8K":
            return { command: "EDGAR", ticker, form: "8-K" };
          case "DES":
          case "PROFILE":
            return { command: "DES", ticker };
          case "ANR":
          case "RECOMMENDATIONS":
            return { command: "ANR", ticker };
          case "EARN":
          case "EARNINGS":
            return { command: "EARN", ticker };
          case "DVD":
          case "DIVIDEND":
          case "DIVIDENDS":
            return { command: "DVD", ticker };
          case "RV":
          case "PEERS":
          case "COMPS":
            return { command: "RV", ticker };
          case "HDS":
          case "HOLDERS":
            return { command: "HDS", ticker };
          case "QR":
          case "TRADES":
            return { command: "QR", symbol: ticker };
          case "BOOK":
          case "DEPTH":
          case "L2":
          case "STOCK":
            return { command: "STOCK", symbol: ticker };
          case "NEWS":
            return { command: "NEWS", query: ticker };
          default:
            // Default action for "TICKER EQUITY": Financials & Fundamentals
            return { command: "FA", ticker };
        }
      }

      case "CRYPTO": {
        let sym = ticker;
        if (!sym.endsWith("USDT") && !sym.endsWith("BUSD")) {
          sym = `${sym}USDT`;
        }
        switch (func) {
          case "GP":
          case "G":
          case "CHART":
            return { command: "CHART", symbol: sym };
          case "QR":
          case "TRADES":
            return { command: "QR", symbol: sym };
          case "NEWS":
            return { command: "NEWS", query: ticker };
          case "BOOK":
          case "DEPTH":
          case "L2":
          default:
            return { command: "BOOK", symbol: sym };
        }
      }

      case "CURNCY": {
        const { from, to } = parseCurrencyPair(ticker);
        return { command: "FX", from: from || "USD", to };
      }

      case "GOVT": {
        return { command: "YIELD" };
      }

      case "INDEX": {
        return { command: "WEI" };
      }

      case "COM": {
        return { command: "COMM" };
      }
    }
  }

  // Bare command or legacy shortcut parsing
  const firstToken = upperTokens[0];
  const restTokens = tokens.slice(1);
  const rest = restTokens.join(" ");

  switch (firstToken) {
    case "TOP": {
      // e.g. "TOP", "TOP TECH", "TOP FX"
      return { command: "NEWS", query: rest };
    }
    case "CHART":
    case "G":
    case "GP": {
      const symbol = rest.trim().toUpperCase() || "AAPL";
      return { command: "CHART", symbol };
    }
    case "FA":
    case "FINANCIALS": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "FA", ticker };
    }
    case "DES":
    case "PROFILE": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "DES", ticker };
    }
    case "ANR": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "ANR", ticker };
    }
    case "EARN":
    case "EARNINGS": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "EARN", ticker };
    }
    case "MOST":
    case "MOV":
      return { command: "MOST" };
    case "FXC":
      return { command: "FXC" };
    case "COMM": {
      const query = rest.trim().toUpperCase();
      return { command: "COMM", ...(query ? { query } : {}) };
    }
    case "DVD":
    case "DIVIDEND":
    case "DIVIDENDS": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "DVD", ticker };
    }
    case "RV":
    case "PEERS":
    case "COMPS": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "RV", ticker };
    }
    case "WIRP":
    case "FED":
      return { command: "WIRP" };
    case "WBON":
    case "BOND":
      return { command: "WBON" };
    case "CORR":
      return { command: "CORR" };
    case "VOL":
    case "VIX":
      return { command: "VOL" };
    case "HDS":
    case "HOLDERS": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "HDS", ticker };
    }
    case "QR":
    case "TRADES": {
      const symbol = rest.trim().toUpperCase() || "BTCUSDT";
      return { command: "QR", symbol };
    }
    case "SECF":
    case "FIND":
    case "SEARCH": {
      const query = rest.trim();
      return { command: "SECF", ...(query ? { query } : {}) };
    }
    case "OMON":
    case "OPTIONS": {
      const symbol = rest.trim().toUpperCase() || "AAPL";
      return { command: "OMON", symbol };
    }
    case "ECO":
    case "CALENDAR":
    case "EVENTS":
      return { command: "ECO" };
    case "NEWS":
      return { command: "NEWS", query: rest };
    case "ECON":
      return { command: "ECON", query: rest };
    case "WEI": {
      if (rest) {
        const { from, to } = parseCurrencyPair(rest);
        return { command: "WEI", from, to };
      }
      return { command: "WEI" };
    }
    case "FX": {
      const { from, to } = parseCurrencyPair(rest);
      return { command: "FX", from: from || "USD", to };
    }
    case "EDGAR":
    case "FILINGS":
    case "SEC": {
      const parts = rest.trim().toUpperCase().split(/\s+/).filter(Boolean);
      const ticker = parts[0] || "AAPL";
      const form = parts[1] || "ALL";
      return { command: "EDGAR", ticker, form };
    }
    case "10-K":
    case "10K": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "EDGAR", ticker, form: "10-K" };
    }
    case "10-Q":
    case "10Q": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "EDGAR", ticker, form: "10-Q" };
    }
    case "8-K":
    case "8K": {
      const ticker = rest.trim().toUpperCase() || "AAPL";
      return { command: "EDGAR", ticker, form: "8-K" };
    }
    case "STOCK": {
      const symbol = rest.trim().toUpperCase() || "AAPL";
      return { command: "STOCK", symbol };
    }
    case "BOOK": {
      const symbol = rest.trim().toUpperCase() || "BTCUSDT";
      return { command: "BOOK", symbol };
    }
    case "YIELD":
    case "CURVE":
      return { command: "YIELD" };
    case "FNG":
    case "SENT":
      return { command: "FNG" };
    case "HELP":
      return { command: "HELP" };
    default:
      return { command: "UNKNOWN", input: normalized };
  }
}

export function addToHistory(command: string, history: string[]): string[] {
  const trimmed = command.trim();
  if (!trimmed) return history;
  const filtered = history.filter((h) => h !== trimmed);
  return [trimmed, ...filtered].slice(0, 20);
}

const HISTORY_KEY = "terminal:cmd:history";

export function loadHistory(): string[] {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveHistory(history: string[]) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {
    // localStorage unavailable
  }
}

// Re-export verified symbols for backward compatibility
export const KNOWN_EQUITIES = VERIFIED_EQUITIES;
export const KNOWN_CRYPTOS = VERIFIED_CRYPTOS;
export const KNOWN_INDICES = VERIFIED_INDICES;
export const KNOWN_GOVT = VERIFIED_GOVT;
export const KNOWN_COMMODITIES = VERIFIED_COMMODITIES;
export const KNOWN_CURRENCIES = VERIFIED_CURRENCIES;

export const RESERVED_COMMANDS = new Set([
  "NEWS",
  "TOP",
  "ECON",
  "HELP",
  "YIELD",
  "CURVE",
  "FNG",
  "SENT",
  "WEI",
  "FX",
  "STOCK",
  "BOOK",
  "CHART",
  "G",
  "GP",
  "FA",
  "FINANCIALS",
  "OMON",
  "OPTIONS",
  "EDGAR",
  "FILINGS",
  "SEC",
  "ECO",
  "CALENDAR",
  "EVENTS",
  "10-K",
  "10K",
  "10-Q",
  "10Q",
  "8-K",
  "8K",
  "DES",
  "ANR",
  "EARN",
  "MOST",
  "MOV",
  "FXC",
  "COMM",
  "DVD",
  "DIVIDEND",
  "RV",
  "PEERS",
  "TOP",
  "WIRP",
  "FED",
  "WBON",
  "BOND",
  "CORR",
  "VOL",
  "VIX",
  "HDS",
  "HOLDERS",
  "QR",
  "TRADES",
  "GO",
  "<GO>",
  "EQUITY",
  "CRYPTO",
  "INDEX",
  "GOVT",
  "COM",
  "CURNCY",
]);

type ScoredCommand = CommandDef & { score: number };

export function getCommandSuggestions(rawInput: string, history: string[] = []): CommandDef[] {
  const input = rawInput.trimStart();
  if (!input) return [];

  const q = input.toUpperCase();
  const candidates: ScoredCommand[] = [];

  function add(def: CommandDef, baseScore: number) {
    let score = baseScore;

    // Recency / History Boost: prioritize commands or securities user recently interacted with
    if (history && history.length > 0) {
      const recent = history.slice(0, 8);
      for (let idx = 0; idx < recent.length; idx++) {
        const h = recent[idx].toUpperCase();
        if (h === def.name || h.startsWith(def.name + " ") || def.name.startsWith(h)) {
          score += 350 - idx * 15;
          break;
        }
        const firstWord = def.name.split(" ")[0];
        if (firstWord && (h === firstWord || h.startsWith(firstWord + " ") || h.includes(firstWord))) {
          score += 250 - idx * 15;
          break;
        }
      }
    }

    candidates.push({ ...def, score });
  }

  const spaceIdx = q.indexOf(" ");

  // STATE 1: Single word typed before any whitespace (e.g. "SPX", "NE", "AAPL", "N", "M")
  if (spaceIdx === -1) {
    // 1A. Command Keyword Matches (e.g. "NE" -> "NEWS", "EC" -> "ECO", "YI" -> "YIELD")
    for (const cmd of COMMANDS) {
      if (cmd.name === q) {
        // Exact match on command name (e.g. typing "TOP", "NEWS", "HELP", "WEI")
        add(cmd, 1100);
      } else if (cmd.name.startsWith(q + " ")) {
        add(cmd, 950);
      } else if (cmd.name.startsWith(q)) {
        add(cmd, 850);
      }
    }

    // 1B. Security Matches strictly from the Verified Catalog (ONLY if not a reserved command)
    if (!RESERVED_COMMANDS.has(q)) {
      // Indices (e.g. "SPX" -> "SPX INDEX", "NDX" -> "NDX INDEX")
      const matchingIndices = VERIFIED_INDICES.filter((idx) => idx.ticker.startsWith(q));
      for (const idx of matchingIndices) {
        const isExact = idx.ticker === q;
        const tierBonus = idx.tier === 1 ? 250 : idx.tier === 2 ? 120 : 40;
        add(
          {
            name: `${idx.ticker} INDEX`,
            description: `Bloomberg: ${idx.name} & World Indices (WEI)`,
          },
          (isExact ? 1000 : 600) + tierBonus
        );
      }

      // Sovereign Yields (e.g. "US10Y" -> "US10Y GOVT")
      const matchingGovt = VERIFIED_GOVT.filter((g) => g.ticker.startsWith(q));
      for (const g of matchingGovt) {
        const isExact = g.ticker === q;
        const tierBonus = g.tier === 1 ? 250 : g.tier === 2 ? 120 : 40;
        add(
          {
            name: `${g.ticker} GOVT`,
            description: `Bloomberg: ${g.name} Benchmark Yield Curve`,
          },
          (isExact ? 1000 : 600) + tierBonus
        );
      }

      // Currencies (e.g. "EURUSD" -> "EURUSD CURNCY")
      const matchingCurrs = VERIFIED_CURRENCIES.filter((c) => c.pair.startsWith(q));
      for (const c of matchingCurrs) {
        const isExact = c.pair === q;
        const tierBonus = c.tier === 1 ? 250 : c.tier === 2 ? 120 : 40;
        add(
          {
            name: `${c.pair} CURNCY`,
            description: `Bloomberg: ${c.name} Exchange Rate Matrix`,
          },
          (isExact ? 1000 : 600) + tierBonus
        );
      }

      // Commodities (e.g. "CL1" -> "CL1 COM", "GOLD" -> "GOLD COM")
      const matchingComms = VERIFIED_COMMODITIES.filter((c) => c.ticker.startsWith(q));
      for (const c of matchingComms) {
        const isExact = c.ticker === q;
        const tierBonus = c.tier === 1 ? 250 : c.tier === 2 ? 120 : 40;
        add(
          {
            name: `${c.ticker} COM`,
            description: `Bloomberg: ${c.name} Commodity Benchmark`,
          },
          (isExact ? 1000 : 600) + tierBonus
        );
      }

      // Verified US Equities (e.g. "NVDA", "SOFI", "GME", "PLTR", "AAPL", "SMCI")
      const matchingEq = VERIFIED_EQUITIES.filter((e) => e.ticker.startsWith(q));
      for (const eq of matchingEq.slice(0, 8)) {
        const isExact = eq.ticker === q;
        const tierBonus = eq.tier === 1 ? 250 : eq.tier === 2 ? 120 : 40;
        const baseMatch = (isExact ? 1000 : 600) + tierBonus;

        add({ name: `${eq.ticker} US EQUITY GP`, description: `Bloomberg: Candlestick chart for ${eq.name}` }, baseMatch + 50);
        if (isExact) {
          add({ name: `${eq.ticker} US EQUITY FA`, description: `Bloomberg: Fundamentals for ${eq.name}` }, baseMatch + 40);
          add({ name: `${eq.ticker} US EQUITY OMON`, description: `Bloomberg: Options chain for ${eq.name}` }, baseMatch + 30);
          add({ name: `${eq.ticker} US EQUITY SEC`, description: `Bloomberg: SEC filings for ${eq.name}` }, baseMatch + 20);
          add({ name: `${eq.ticker} US EQUITY BOOK`, description: `Bloomberg: Order book for ${eq.name}` }, baseMatch + 10);
        }
      }

      // Verified Cryptocurrencies (e.g. "BTC", "ETH", "SOL", "SUI", "PEPE")
      const matchingCrypto = VERIFIED_CRYPTOS.filter((c) => c.symbol.startsWith(q));
      for (const c of matchingCrypto.slice(0, 6)) {
        const isExact = c.symbol === q;
        const tierBonus = c.tier === 1 ? 250 : c.tier === 2 ? 120 : 40;
        const baseMatch = (isExact ? 1000 : 600) + tierBonus;

        add({ name: `${c.symbol} CRYPTO`, description: `Bloomberg: Crypto order book for ${c.name}` }, baseMatch + 50);
        if (isExact) {
          add({ name: `${c.symbol} CRYPTO GP`, description: `Bloomberg: Candlestick chart for ${c.name}` }, baseMatch + 40);
        }
      }
    }
  } else {
    // STATE 2: Space has been typed (Arguments or multi-token commands)
    const cmdPrefix = q.slice(0, spaceIdx).trim();
    const argPrefix = q.slice(spaceIdx + 1).trim();

    // 2A. Domain Argument Provider: NEWS [TOPIC]
    if (cmdPrefix === "NEWS") {
      const topics = ["BITCOIN", "FEDERAL RESERVE", "INFLATION", "TECH", "AI", "EARNINGS"];
      for (let i = 0; i < topics.length; i++) {
        const t = topics[i];
        if (!argPrefix || t.startsWith(argPrefix)) {
          add({ name: `NEWS ${t}`, description: `Filter news for "${t}"` }, 900 - i * 20);
        }
      }
      const matchingEq = VERIFIED_EQUITIES.filter((e) => !argPrefix || e.ticker.startsWith(argPrefix));
      for (const eq of matchingEq.slice(0, 4)) {
        const tierBonus = eq.tier === 1 ? 150 : eq.tier === 2 ? 80 : 20;
        add({ name: `NEWS ${eq.ticker}`, description: `Company news for ${eq.name}` }, 750 + tierBonus);
      }
    }

    // 2B. Domain Argument Provider: TOP [CHANNEL]
    else if (cmdPrefix === "TOP") {
      const topChannels = [
        { ch: "TECH", desc: "Technology & Semiconductor news" },
        { ch: "FX", desc: "Foreign exchange & currencies" },
        { ch: "MACRO", desc: "Central banks & macroeconomic data" },
        { ch: "CRYPTO", desc: "Digital assets & crypto news" },
        { ch: "DEALS", desc: "M&A, IPOs & Corporate Deals" },
      ];
      for (let i = 0; i < topChannels.length; i++) {
        const tc = topChannels[i];
        if (!argPrefix || tc.ch.startsWith(argPrefix)) {
          add({ name: `TOP ${tc.ch}`, description: `Bloomberg Top: ${tc.desc}` }, 950 - i * 20);
        }
      }
    }

    // 2C. Domain Argument Provider: ECON [SERIES]
    else if (cmdPrefix === "ECON") {
      const macroSeries = [
        { code: "GDP", name: "Gross Domestic Product" },
        { code: "CPI", name: "Consumer Price Index (Inflation)" },
        { code: "UNRATE", name: "Unemployment Rate" },
        { code: "FEDFUNDS", name: "Federal Funds Effective Rate" },
        { code: "DGS10", name: "10-Year Treasury Constant Maturity Rate" },
        { code: "PAYEMS", name: "Total Nonfarm Payrolls" },
        { code: "M2SL", name: "M2 Money Supply" },
      ];
      for (let i = 0; i < macroSeries.length; i++) {
        const ms = macroSeries[i];
        if (!argPrefix || ms.code.startsWith(argPrefix) || ms.name.toUpperCase().includes(argPrefix)) {
          add({ name: `ECON ${ms.code}`, description: `FRED Macro: ${ms.name}` }, 950 - i * 20);
        }
      }
    }

    // 2D. Domain Argument Provider: FX [PAIR]
    else if (cmdPrefix === "FX") {
      const fxPairs = [
        { pair: "EUR USD", name: "Euro to US Dollar" },
        { pair: "GBP USD", name: "British Pound to US Dollar" },
        { pair: "USD JPY", name: "US Dollar to Japanese Yen" },
        { pair: "USD INR", name: "US Dollar to Indian Rupee" },
        { pair: "USD CAD", name: "US Dollar to Canadian Dollar" },
        { pair: "AUD USD", name: "Australian Dollar to US Dollar" },
      ];
      for (let i = 0; i < fxPairs.length; i++) {
        const fp = fxPairs[i];
        if (!argPrefix || fp.pair.startsWith(argPrefix)) {
          add({ name: `FX ${fp.pair}`, description: `Exchange Rate: ${fp.name}` }, 950 - i * 20);
        }
      }
    }

    // 2E. Domain Argument Provider: Ticker Commands (FA, CHART, OMON, EDGAR, STOCK, BOOK, DES, ANR, EARN)
    else if (
      [
        "FA",
        "FINANCIALS",
        "CHART",
        "G",
        "GP",
        "OMON",
        "OPTIONS",
        "EDGAR",
        "FILINGS",
        "SEC",
        "DES",
        "PROFILE",
        "ANR",
        "EARN",
        "EARNINGS",
        "10-K",
        "10-Q",
        "8-K",
        "STOCK",
        "BOOK",
      ].includes(cmdPrefix)
    ) {
      const parts = q.split(/\s+/).filter(Boolean);
      // SEC Form completion: "EDGAR AAPL " or "SEC NVDA "
      if ((cmdPrefix === "EDGAR" || cmdPrefix === "SEC" || cmdPrefix === "FILINGS") && parts.length >= 2 && q.endsWith(" ")) {
        const ticker = parts[1];
        const formTypes = [
          { form: "10-K", desc: "Annual audited financial report", weight: 50 },
          { form: "10-Q", desc: "Quarterly financial report", weight: 40 },
          { form: "8-K", desc: "Current material events & earnings release", weight: 30 },
          { form: "FORM 4", desc: "Insider trading transaction disclosures", weight: 20 },
          { form: "DEF 14A", desc: "Annual proxy statement & executive compensation", weight: 10 },
        ];
        for (const ft of formTypes) {
          add(
            {
              name: `${cmdPrefix} ${ticker} ${ft.form}`,
              description: `SEC Filing: ${ft.desc}`,
            },
            900 + ft.weight
          );
        }
      } else {
        // Suggest matching verified equities ordered by tier
        const matchingEq = VERIFIED_EQUITIES.filter((e) => !argPrefix || e.ticker.startsWith(argPrefix));
        for (const eq of matchingEq.slice(0, 6)) {
          const tierBonus = eq.tier === 1 ? 250 : eq.tier === 2 ? 120 : 40;
          add(
            {
              name: `${cmdPrefix} ${eq.ticker}`,
              description: `${eq.name} (${eq.ticker})`,
            },
            800 + tierBonus
          );
        }

        // If crypto-friendly command, suggest matching verified cryptos
        if (["CHART", "G", "GP", "BOOK"].includes(cmdPrefix)) {
          const matchingCrypto = VERIFIED_CRYPTOS.filter(
            (c) => !argPrefix || c.symbol.startsWith(argPrefix) || `${c.symbol}USDT`.startsWith(argPrefix)
          );
          for (const c of matchingCrypto.slice(0, 3)) {
            const tierBonus = c.tier === 1 ? 250 : c.tier === 2 ? 120 : 40;
            add(
              {
                name: `${cmdPrefix} ${c.symbol}USDT`,
                description: `${c.name} Crypto (${c.symbol}USDT)`,
              },
              800 + tierBonus
            );
          }
        }
      }
    }

    // 2F. Bloomberg Multi-Token Syntax: <TICKER> US EQUITY <FUNCTION>
    else if (q.includes("EQUITY")) {
      const parts = q.split(/\s+/);
      const ticker = parts[0];
      if (KNOWN_EQUITY_SET.has(ticker)) {
        const eqInfo = VERIFIED_EQUITIES.find((e) => e.ticker === ticker);
        const label = eqInfo?.name ?? ticker;
        const base = parts.slice(0, parts.indexOf("EQUITY") + 1).join(" ");
        const funcPart = parts.slice(parts.indexOf("EQUITY") + 1).join(" ");

        const equityFuncs = [
          { func: "GP", desc: `Candlestick chart for ${label}`, weight: 60 },
          { func: "FA", desc: `Fundamentals & balance sheet for ${label}`, weight: 50 },
          { func: "DES", desc: `Company dossier & executives for ${label}`, weight: 45 },
          { func: "ANR", desc: `Analyst recommendations & targets for ${label}`, weight: 40 },
          { func: "EARN", desc: `Quarterly earnings surprises for ${label}`, weight: 35 },
          { func: "OMON", desc: `Options chain for ${label}`, weight: 30 },
          { func: "SEC", desc: `SEC filings for ${label}`, weight: 20 },
          { func: "BOOK", desc: `Live order book for ${label}`, weight: 10 },
          { func: "NEWS", desc: `News headlines for ${label}`, weight: 5 },
        ];

        for (const ef of equityFuncs) {
          if (!funcPart || ef.func.startsWith(funcPart)) {
            add(
              {
                name: `${base} ${ef.func}`,
                description: `Bloomberg: ${ef.desc}`,
              },
              1000 + ef.weight
            );
          }
        }
      }
    }

    // 2G. Bloomberg Multi-Token Syntax: <TICKER> CRYPTO <FUNCTION>
    else if (q.includes("CRYPTO")) {
      const parts = q.split(/\s+/);
      const ticker = parts[0];
      if (KNOWN_CRYPTO_SET.has(ticker)) {
        const base = `${ticker} CRYPTO`;
        const funcPart = parts.slice(parts.indexOf("CRYPTO") + 1).join(" ");
        const cryptoFuncs = [
          { func: "BOOK", desc: `Real-time order book for ${ticker}`, weight: 50 },
          { func: "GP", desc: `Candlestick chart for ${ticker}`, weight: 40 },
          { func: "NEWS", desc: `News for ${ticker}`, weight: 20 },
        ];
        for (const cf of cryptoFuncs) {
          if (!funcPart || cf.func.startsWith(funcPart)) {
            add(
              {
                name: `${base} ${cf.func}`,
                description: `Bloomberg: ${cf.desc}`,
              },
              1000 + cf.weight
            );
          }
        }
      }
    }

    // 2H. Bloomberg Asset Classes: INDEX, GOVT, CURNCY, COM
    else if (q.includes("INDEX")) {
      const ticker = q.split(/\s+/)[0];
      if (KNOWN_INDEX_SET.has(ticker)) {
        const idxInfo = VERIFIED_INDICES.find((i) => i.ticker === ticker);
        const label = idxInfo?.name ?? ticker;
        add(
          {
            name: `${ticker} INDEX`,
            description: `Bloomberg: ${label} & World Equity Indices (WEI)`,
          },
          1000
        );
      }
    } else if (q.includes("GOVT")) {
      const ticker = q.split(/\s+/)[0];
      if (KNOWN_GOVT_SET.has(ticker)) {
        const gInfo = VERIFIED_GOVT.find((g) => g.ticker === ticker);
        const label = gInfo?.name ?? ticker;
        add(
          {
            name: `${ticker} GOVT`,
            description: `Bloomberg: ${label} Benchmark Yield Curve`,
          },
          1000
        );
      }
    } else if (q.includes("CURNCY")) {
      const pair = q.split(/\s+/)[0];
      if (KNOWN_CURRENCY_SET.has(pair)) {
        const cInfo = VERIFIED_CURRENCIES.find((c) => c.pair === pair);
        const label = cInfo?.name ?? pair;
        add(
          {
            name: `${pair} CURNCY`,
            description: `Bloomberg: ${label} Exchange Rate Matrix`,
          },
          1000
        );
      }
    } else if (q.includes("COM")) {
      const ticker = q.split(/\s+/)[0];
      if (KNOWN_COMMODITY_SET.has(ticker)) {
        const comInfo = VERIFIED_COMMODITIES.find((c) => c.ticker === ticker);
        const label = comInfo?.name ?? ticker;
        add(
          {
            name: `${ticker} COM`,
            description: `Bloomberg: ${label} Commodity Benchmark`,
          },
          1000
        );
      }
    }

    // 2I. Verified Security followed by space (e.g. "NVDA ", "AAPL ", "BTC ", "SPX ")
    else if (KNOWN_EQUITY_SET.has(cmdPrefix)) {
      const eqInfo = VERIFIED_EQUITIES.find((e) => e.ticker === cmdPrefix);
      const label = eqInfo?.name ?? cmdPrefix;
      add({ name: `${cmdPrefix} US EQUITY GP`, description: `Bloomberg: Candlestick chart for ${label}` }, 1060);
      add({ name: `${cmdPrefix} US EQUITY FA`, description: `Bloomberg: Fundamentals for ${label}` }, 1050);
      add({ name: `${cmdPrefix} US EQUITY DES`, description: `Bloomberg: Company dossier & executives for ${label}` }, 1045);
      add({ name: `${cmdPrefix} US EQUITY ANR`, description: `Bloomberg: Analyst recommendations & targets for ${label}` }, 1040);
      add({ name: `${cmdPrefix} US EQUITY EARN`, description: `Bloomberg: Quarterly earnings surprises for ${label}` }, 1035);
      add({ name: `${cmdPrefix} US EQUITY OMON`, description: `Bloomberg: Options chain for ${label}` }, 1030);
      add({ name: `${cmdPrefix} US EQUITY SEC`, description: `Bloomberg: SEC filings for ${label}` }, 1020);
      add({ name: `${cmdPrefix} US EQUITY BOOK`, description: `Bloomberg: Order book for ${label}` }, 1010);
    } else if (KNOWN_CRYPTO_SET.has(cmdPrefix)) {
      const cryptoInfo = VERIFIED_CRYPTOS.find((c) => c.symbol === cmdPrefix);
      const label = cryptoInfo?.name ?? cmdPrefix;
      add({ name: `${cmdPrefix} CRYPTO`, description: `Bloomberg: Crypto order book for ${label}` }, 1050);
      add({ name: `${cmdPrefix} CRYPTO GP`, description: `Bloomberg: Candlestick chart for ${label}` }, 1040);
    } else if (KNOWN_INDEX_SET.has(cmdPrefix)) {
      const idxInfo = VERIFIED_INDICES.find((i) => i.ticker === cmdPrefix);
      add({ name: `${cmdPrefix} INDEX`, description: `Bloomberg: ${idxInfo?.name ?? cmdPrefix} & World Indices (WEI)` }, 1000);
    } else if (KNOWN_GOVT_SET.has(cmdPrefix)) {
      const gInfo = VERIFIED_GOVT.find((g) => g.ticker === cmdPrefix);
      add({ name: `${cmdPrefix} GOVT`, description: `Bloomberg: ${gInfo?.name ?? cmdPrefix} Yield Curve` }, 1000);
    } else if (KNOWN_COMMODITY_SET.has(cmdPrefix)) {
      const comInfo = VERIFIED_COMMODITIES.find((c) => c.ticker === cmdPrefix);
      add({ name: `${cmdPrefix} COM`, description: `Bloomberg: ${comInfo?.name ?? cmdPrefix} Commodity` }, 1000);
    } else if (KNOWN_CURRENCY_SET.has(cmdPrefix)) {
      const cInfo = VERIFIED_CURRENCIES.find((c) => c.pair === cmdPrefix);
      add({ name: `${cmdPrefix} CURNCY`, description: `Bloomberg: ${cInfo?.name ?? cmdPrefix} Exchange Rate` }, 1000);
    }
  }

  // Sort candidates in descending order of score
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate preserving the highest scored definition
  const results: CommandDef[] = [];
  const seen = new Set<string>();
  for (const item of candidates) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      results.push({
        name: item.name,
        args: item.args,
        description: item.description,
      });
      if (results.length >= 10) break;
    }
  }

  return results;
}
