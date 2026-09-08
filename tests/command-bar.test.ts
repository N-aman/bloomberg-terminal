/**
 * Unit tests for CommandBar parsing, autocomplete matching, and history.
 */

import { describe, it, expect } from "vitest";
import {
  parseCommand,
  addToHistory,
  COMMANDS,
  getCommandSuggestions,
} from "../lib/commands";

describe("CommandBar — parseCommand", () => {
  it("parses NEWS commands with arguments", () => {
    expect(parseCommand("NEWS bitcoin")).toEqual({
      command: "NEWS",
      query: "bitcoin",
    });
    expect(parseCommand("news   federal reserve  ")).toEqual({
      command: "NEWS",
      query: "federal reserve",
    });
  });

  it("parses ECON commands with search terms", () => {
    expect(parseCommand("ECON inflation")).toEqual({
      command: "ECON",
      query: "inflation",
    });
    expect(parseCommand("econ gdp")).toEqual({
      command: "ECON",
      query: "gdp",
    });
  });

  it("parses WEI command for global indices with optional currency pairs", () => {
    expect(parseCommand("WEI")).toEqual({ command: "WEI" });
    expect(parseCommand("wei")).toEqual({ command: "WEI" });
    expect(parseCommand("WEI EUR JPY")).toEqual({
      command: "WEI",
      from: "EUR",
      to: "JPY",
    });
    expect(parseCommand("WEI EUR/USD")).toEqual({
      command: "WEI",
      from: "EUR",
      to: "USD",
    });
  });

  it("parses FX command for arbitrary currency pairs", () => {
    expect(parseCommand("FX EUR USD")).toEqual({
      command: "FX",
      from: "EUR",
      to: "USD",
    });
    expect(parseCommand("fx gbp/jpy")).toEqual({
      command: "FX",
      from: "GBP",
      to: "JPY",
    });
    expect(parseCommand("FX USDINR")).toEqual({
      command: "FX",
      from: "USD",
      to: "INR",
    });
    expect(parseCommand("FX EUR")).toEqual({
      command: "FX",
      from: "EUR",
      to: "",
    });
  });

  it("parses YIELD and alias CURVE for Treasury curve", () => {
    expect(parseCommand("YIELD")).toEqual({ command: "YIELD" });
    expect(parseCommand("yield")).toEqual({ command: "YIELD" });
    expect(parseCommand("CURVE")).toEqual({ command: "YIELD" });
    expect(parseCommand("curve")).toEqual({ command: "YIELD" });
  });

  it("parses FNG and alias SENT for crypto sentiment", () => {
    expect(parseCommand("FNG")).toEqual({ command: "FNG" });
    expect(parseCommand("fng")).toEqual({ command: "FNG" });
    expect(parseCommand("SENT")).toEqual({ command: "FNG" });
    expect(parseCommand("sent")).toEqual({ command: "FNG" });
  });

  it("parses EDGAR and alias FILINGS for SEC corporate disclosures", () => {
    expect(parseCommand("EDGAR AAPL")).toEqual({
      command: "EDGAR",
      ticker: "AAPL",
      form: "ALL",
    });
    expect(parseCommand("edgar nvda 10-k")).toEqual({
      command: "EDGAR",
      ticker: "NVDA",
      form: "10-K",
    });
    expect(parseCommand("FILINGS TSLA")).toEqual({
      command: "EDGAR",
      ticker: "TSLA",
      form: "ALL",
    });
  });

  it("parses 10-K, 10-Q, and 8-K shortcut commands", () => {
    expect(parseCommand("10-K MSFT")).toEqual({
      command: "EDGAR",
      ticker: "MSFT",
      form: "10-K",
    });
    expect(parseCommand("10-Q AMZN")).toEqual({
      command: "EDGAR",
      ticker: "AMZN",
      form: "10-Q",
    });
    expect(parseCommand("8-K GOOGL")).toEqual({
      command: "EDGAR",
      ticker: "GOOGL",
      form: "8-K",
    });
  });

  it("parses STOCK and BOOK commands for live order books", () => {
    expect(parseCommand("STOCK AAPL")).toEqual({
      command: "STOCK",
      symbol: "AAPL",
    });
    expect(parseCommand("BOOK BTCUSDT")).toEqual({
      command: "BOOK",
      symbol: "BTCUSDT",
    });
  });

  it("parses HELP command", () => {
    expect(parseCommand("HELP")).toEqual({ command: "HELP" });
    expect(parseCommand("help")).toEqual({ command: "HELP" });
  });

  it("parses CHART and alias G commands for technical charts", () => {
    expect(parseCommand("CHART AAPL")).toEqual({
      command: "CHART",
      symbol: "AAPL",
    });
    expect(parseCommand("g btcusdt")).toEqual({
      command: "CHART",
      symbol: "BTCUSDT",
    });
  });

  it("parses FA and alias FINANCIALS commands for fundamental statements", () => {
    expect(parseCommand("FA NVDA")).toEqual({
      command: "FA",
      ticker: "NVDA",
    });
    expect(parseCommand("financials msft")).toEqual({
      command: "FA",
      ticker: "MSFT",
    });
  });

  it("parses OMON and alias OPTIONS commands for option chains", () => {
    expect(parseCommand("OMON AAPL")).toEqual({
      command: "OMON",
      symbol: "AAPL",
    });
    expect(parseCommand("options spy")).toEqual({
      command: "OMON",
      symbol: "SPY",
    });
  });

  it("parses ECO and alias CALENDAR commands for economic calendar", () => {
    expect(parseCommand("ECO")).toEqual({ command: "ECO" });
    expect(parseCommand("eco")).toEqual({ command: "ECO" });
    expect(parseCommand("CALENDAR")).toEqual({ command: "ECO" });
  });

  it("handles unknown commands gracefully", () => {
    expect(parseCommand("FOOBAR")).toEqual({
      command: "UNKNOWN",
      input: "FOOBAR",
    });
    expect(parseCommand("")).toEqual({
      command: "UNKNOWN",
      input: "",
    });
  });
});

describe("CommandBar — Bloomberg Multi-Token Grammar (<TICKER> <ASSET_CLASS> <FUNCTION> <GO>)", () => {
  it("parses Equity GP (price chart) commands with and without <GO>", () => {
    expect(parseCommand("AAPL US EQUITY GP <GO>")).toEqual({
      command: "CHART",
      symbol: "AAPL",
    });
    expect(parseCommand("aapl us equity gp <go>")).toEqual({
      command: "CHART",
      symbol: "AAPL",
    });
    expect(parseCommand("TSLA EQUITY GP GO")).toEqual({
      command: "CHART",
      symbol: "TSLA",
    });
    expect(parseCommand("NVDA US EQUITY G")).toEqual({
      command: "CHART",
      symbol: "NVDA",
    });
    expect(parseCommand("MSFT EQUITY CHART <GO>")).toEqual({
      command: "CHART",
      symbol: "MSFT",
    });
  });

  it("parses Equity FA (financial analysis / fundamentals)", () => {
    expect(parseCommand("AAPL US EQUITY FA <GO>")).toEqual({
      command: "FA",
      ticker: "AAPL",
    });
    expect(parseCommand("msft equity fa")).toEqual({
      command: "FA",
      ticker: "MSFT",
    });
    expect(parseCommand("NVDA US EQUITY FINANCIALS <GO>")).toEqual({
      command: "FA",
      ticker: "NVDA",
    });
    // Default function for equity without explicit function is FA
    expect(parseCommand("AAPL US EQUITY <GO>")).toEqual({
      command: "FA",
      ticker: "AAPL",
    });
    expect(parseCommand("GOOGL EQUITY")).toEqual({
      command: "FA",
      ticker: "GOOGL",
    });
  });

  it("parses Equity OMON (option monitor)", () => {
    expect(parseCommand("AAPL US EQUITY OMON <GO>")).toEqual({
      command: "OMON",
      symbol: "AAPL",
    });
    expect(parseCommand("SPY EQUITY OPTIONS")).toEqual({
      command: "OMON",
      symbol: "SPY",
    });
    expect(parseCommand("NVDA US EQUITY OPT <GO>")).toEqual({
      command: "OMON",
      symbol: "NVDA",
    });
  });

  it("parses Equity SEC filings (10-K, 10-Q, 8-K, ALL)", () => {
    expect(parseCommand("AAPL US EQUITY SEC <GO>")).toEqual({
      command: "EDGAR",
      ticker: "AAPL",
      form: "ALL",
    });
    expect(parseCommand("AAPL US EQUITY SEC 10-K <GO>")).toEqual({
      command: "EDGAR",
      ticker: "AAPL",
      form: "10-K",
    });
    expect(parseCommand("MSFT EQUITY 10-Q")).toEqual({
      command: "EDGAR",
      ticker: "MSFT",
      form: "10-Q",
    });
    expect(parseCommand("AMZN US EQUITY 8-K <GO>")).toEqual({
      command: "EDGAR",
      ticker: "AMZN",
      form: "8-K",
    });
  });

  it("parses Equity Order Book (BOOK, DEPTH, STOCK)", () => {
    expect(parseCommand("AAPL US EQUITY BOOK <GO>")).toEqual({
      command: "STOCK",
      symbol: "AAPL",
    });
    expect(parseCommand("NVDA EQUITY DEPTH")).toEqual({
      command: "STOCK",
      symbol: "NVDA",
    });
    expect(parseCommand("TSLA US EQUITY L2 <GO>")).toEqual({
      command: "STOCK",
      symbol: "TSLA",
    });
  });

  it("parses Crypto asset commands with auto-pairing to USDT", () => {
    expect(parseCommand("BTC CRYPTO <GO>")).toEqual({
      command: "BOOK",
      symbol: "BTCUSDT",
    });
    expect(parseCommand("ETH CRYPTO BOOK")).toEqual({
      command: "BOOK",
      symbol: "ETHUSDT",
    });
    expect(parseCommand("SOL CRYPTO GP <GO>")).toEqual({
      command: "CHART",
      symbol: "SOLUSDT",
    });
    expect(parseCommand("BTCUSDT CRYPTO G")).toEqual({
      command: "CHART",
      symbol: "BTCUSDT",
    });
  });

  it("parses Currency, Govt Bonds, and Index asset classes", () => {
    expect(parseCommand("EURUSD CURNCY <GO>")).toEqual({
      command: "FX",
      from: "EUR",
      to: "USD",
    });
    expect(parseCommand("US10Y GOVT <GO>")).toEqual({
      command: "YIELD",
    });
    expect(parseCommand("SPX INDEX <GO>")).toEqual({
      command: "WEI",
    });
  });

  it("parses Global bare commands like TOP and WEI", () => {
    expect(parseCommand("TOP <GO>")).toEqual({
      command: "NEWS",
      query: "",
    });
    expect(parseCommand("TOP TECH <GO>")).toEqual({
      command: "NEWS",
      query: "TECH",
    });
    expect(parseCommand("top fx")).toEqual({
      command: "NEWS",
      query: "fx",
    });
  });
});

describe("CommandBar — Autocomplete Suggestions Registry", () => {
  it("includes all core Bloomberg mnemonics in COMMANDS registry", () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain("NEWS");
    expect(names).toContain("ECON");
    expect(names).toContain("WEI");
    expect(names).toContain("FX");
    expect(names).toContain("EDGAR");
    expect(names).toContain("FILINGS");
    expect(names).toContain("10-K");
    expect(names).toContain("10-Q");
    expect(names).toContain("8-K");
    expect(names).toContain("STOCK");
    expect(names).toContain("BOOK");
    expect(names).toContain("YIELD");
    expect(names).toContain("CURVE");
    expect(names).toContain("FNG");
    expect(names).toContain("SENT");
    expect(names).toContain("HELP");
  });

  it("filters suggestions by prefix", () => {
    const q = "YI";
    const matches = COMMANDS.filter((c) => c.name.startsWith(q));
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe("YIELD");
  });

  it("suggests Bloomberg commands for known tickers (e.g. NVDA, TSLA, MSFT)", () => {
    const nvdaSuggestions = getCommandSuggestions("NVDA");
    const names = nvdaSuggestions.map((s) => s.name);
    expect(names).toContain("NVDA US EQUITY GP");
    expect(names).toContain("NVDA US EQUITY FA");
    expect(names).toContain("NVDA US EQUITY OMON");
    expect(names).toContain("NVDA US EQUITY SEC");
    expect(names).toContain("NVDA US EQUITY BOOK");
  });

  it("suggests Bloomberg commands for any arbitrary ticker (e.g. SNOW, PLTR)", () => {
    const snowSuggestions = getCommandSuggestions("SNOW");
    const names = snowSuggestions.map((s) => s.name);
    expect(names).toContain("SNOW US EQUITY GP");
    expect(names).toContain("SNOW US EQUITY FA");
  });

  it("suggests tickers when user types a command prefix (e.g. 'FA NV', 'CHART TS')", () => {
    const faMatches = getCommandSuggestions("FA NV");
    const names = faMatches.map((s) => s.name);
    expect(names).toContain("FA NVDA");

    const chartMatches = getCommandSuggestions("CHART TS");
    const chartNames = chartMatches.map((s) => s.name);
    expect(chartNames).toContain("CHART TSLA");
  });

  it("suggests functions when user types Bloomberg security prefix (e.g. 'AAPL US EQUITY ')", () => {
    const matches = getCommandSuggestions("AAPL US EQUITY ");
    const names = matches.map((s) => s.name);
    expect(names).toContain("AAPL US EQUITY GP");
    expect(names).toContain("AAPL US EQUITY FA");
    expect(names).toContain("AAPL US EQUITY OMON");
    expect(names).toContain("AAPL US EQUITY SEC");
    expect(names).toContain("AAPL US EQUITY BOOK");
  });

  it("suggests crypto commands for crypto tickers (e.g. 'BTC', 'ETH')", () => {
    const btcMatches = getCommandSuggestions("BTC");
    const names = btcMatches.map((s) => s.name);
    expect(names).toContain("BTC CRYPTO");
    expect(names).toContain("BTC CRYPTO GP");
  });

  it("suggests standard commands for partial prefixes (e.g. 'EC', 'NE')", () => {
    const ecMatches = getCommandSuggestions("EC");
    const names = ecMatches.map((s) => s.name);
    expect(names).toContain("ECO");
    expect(names).toContain("ECON");

    const neMatches = getCommandSuggestions("NE");
    expect(neMatches.map((s) => s.name)).toContain("NEWS");
  });

  it("suggests Index commands for SPX, NDX, VIX", () => {
    const spxMatches = getCommandSuggestions("SPX");
    const names = spxMatches.map((s) => s.name);
    expect(names).toContain("SPX INDEX");

    const ndxMatches = getCommandSuggestions("NDX");
    expect(ndxMatches.map((s) => s.name)).toContain("NDX INDEX");

    const vixMatches = getCommandSuggestions("VIX");
    expect(vixMatches.map((s) => s.name)).toContain("VIX INDEX");
  });

  it("suggests Govt, Currency, and Commodity commands (US10Y, EURUSD, CL1)", () => {
    const us10yMatches = getCommandSuggestions("US10Y");
    expect(us10yMatches.map((s) => s.name)).toContain("US10Y GOVT");

    const eurusdMatches = getCommandSuggestions("EURUSD");
    expect(eurusdMatches.map((s) => s.name)).toContain("EURUSD CURNCY");

    const cl1Matches = getCommandSuggestions("CL1");
    expect(cl1Matches.map((s) => s.name)).toContain("CL1 COM");
  });

  it("suggests channels when user types 'TOP '", () => {
    const topMatches = getCommandSuggestions("TOP ");
    const names = topMatches.map((s) => s.name);
    expect(names).toContain("TOP TECH");
    expect(names).toContain("TOP FX");
    expect(names).toContain("TOP MACRO");
  });

  it("suggests macro series when user types 'ECON '", () => {
    const econMatches = getCommandSuggestions("ECON ");
    const names = econMatches.map((s) => s.name);
    expect(names).toContain("ECON GDP");
    expect(names).toContain("ECON CPI");
    expect(names).toContain("ECON UNRATE");
  });

  it("suggests currency pairs when user types 'FX '", () => {
    const fxMatches = getCommandSuggestions("FX ");
    const names = fxMatches.map((s) => s.name);
    expect(names).toContain("FX EUR USD");
    expect(names).toContain("FX USD JPY");
  });

  it("suggests SEC forms when user types 'EDGAR AAPL '", () => {
    const edgarMatches = getCommandSuggestions("EDGAR AAPL ");
    const names = edgarMatches.map((s) => s.name);
    expect(names).toContain("EDGAR AAPL 10-K");
    expect(names).toContain("EDGAR AAPL 10-Q");
    expect(names).toContain("EDGAR AAPL 8-K");
  });

  it("suggests Bloomberg commands when user types a ticker followed by a space (e.g. 'NVDA ')", () => {
    const nvdaSpaceMatches = getCommandSuggestions("NVDA ");
    const names = nvdaSpaceMatches.map((s) => s.name);
    expect(names).toContain("NVDA US EQUITY GP");
    expect(names).toContain("NVDA US EQUITY FA");
  });

  it("strictly rejects random English words and non-existent symbols (Zero Hallucination)", () => {
    expect(getCommandSuggestions("HELLO")).toEqual([]);
    expect(getCommandSuggestions("TEST")).toEqual([]);
    expect(getCommandSuggestions("FOOD")).toEqual([]);
    expect(getCommandSuggestions("RANDOM")).toEqual([]);
    expect(getCommandSuggestions("FOOBAR")).toEqual([]);
    expect(getCommandSuggestions("HELLO ")).toEqual([]);
    expect(getCommandSuggestions("FOOD ")).toEqual([]);
  });

  it("never hallucinates equity commands for reserved commands (e.g. 'NEWS ' or 'TOP ')", () => {
    const newsMatches = getCommandSuggestions("NEWS ");
    const newsNames = newsMatches.map((s) => s.name);
    expect(newsNames).not.toContain("NEWS US EQUITY GP");
    expect(newsNames).not.toContain("NEWS US EQUITY FA");
    expect(newsNames).toContain("NEWS BITCOIN");
    expect(newsNames).toContain("NEWS TECH");

    const topMatches = getCommandSuggestions("TOP ");
    const topNames = topMatches.map((s) => s.name);
    expect(topNames).not.toContain("TOP US EQUITY GP");
    expect(topNames).toContain("TOP TECH");
  });

  it("suggests any fetchable security across retail, growth, and new cryptos (SOFI, GME, SMCI, SUI, PEPE)", () => {
    const sofiMatches = getCommandSuggestions("SOFI");
    expect(sofiMatches.map((s) => s.name)).toContain("SOFI US EQUITY GP");

    const gmeMatches = getCommandSuggestions("GME");
    expect(gmeMatches.map((s) => s.name)).toContain("GME US EQUITY GP");

    const smciMatches = getCommandSuggestions("SMCI");
    expect(smciMatches.map((s) => s.name)).toContain("SMCI US EQUITY GP");

    const suiMatches = getCommandSuggestions("SUI");
    expect(suiMatches.map((s) => s.name)).toContain("SUI CRYPTO");

    const pepeMatches = getCommandSuggestions("PEPE");
    expect(pepeMatches.map((s) => s.name)).toContain("PEPE CRYPTO");
  });
});

describe("CommandBar — History Management", () => {
  it("prepends new commands and deduplicates existing ones", () => {
    const history = ["NEWS btc", "WEI", "ECON gdp"];
    const updated = addToHistory("WEI", history);

    expect(updated[0]).toBe("WEI");
    expect(updated.filter((h) => h === "WEI").length).toBe(1);
    expect(updated.length).toBe(3);
  });

  it("ignores empty or whitespace-only inputs", () => {
    const history = ["NEWS btc"];
    expect(addToHistory("", history)).toEqual(history);
    expect(addToHistory("   ", history)).toEqual(history);
  });

  it("caps history at 20 items", () => {
    let history: string[] = [];
    for (let i = 0; i < 25; i++) {
      history = addToHistory(`CMD ${i}`, history);
    }
    expect(history.length).toBe(20);
    expect(history[0]).toBe("CMD 24");
  });
});

describe("CommandBar — Priority & Scoring Engine", () => {
  it("prioritizes exact matches at rank #1 (SPX, TOP, AAPL)", () => {
    const spxResults = getCommandSuggestions("SPX");
    expect(spxResults[0].name).toBe("SPX INDEX");

    const topResults = getCommandSuggestions("TOP");
    expect(topResults[0].name).toBe("TOP");

    const aaplResults = getCommandSuggestions("AAPL");
    expect(aaplResults[0].name).toBe("AAPL US EQUITY GP");
  });

  it("prioritizes Tier 1 Mega-Caps over lesser-known tickers on single character prefixes", () => {
    // For "N", NVDA (Tier 1) should be #1
    const nResults = getCommandSuggestions("N");
    expect(nResults[0].name).toBe("NVDA US EQUITY GP");

    // For "M", MSFT (Tier 1) or META (Tier 1) should outrank MU
    const mResults = getCommandSuggestions("M");
    expect(["MSFT US EQUITY GP", "META US EQUITY GP"]).toContain(mResults[0].name);

    // For "B", BTC (Tier 1) should outrank lower-tier assets
    const bResults = getCommandSuggestions("B");
    expect(bResults[0].name).toBe("BTC CRYPTO");
  });

  it("maintains canonical Bloomberg analytical function hierarchy (GP > FA > DES > ANR > EARN > OMON > SEC > BOOK)", () => {
    const tslaResults = getCommandSuggestions("TSLA ");
    const names = tslaResults.map((r) => r.name);
    expect(names[0]).toBe("TSLA US EQUITY GP");
    expect(names[1]).toBe("TSLA US EQUITY FA");
    expect(names[2]).toBe("TSLA US EQUITY DES");
    expect(names[3]).toBe("TSLA US EQUITY ANR");
    expect(names[4]).toBe("TSLA US EQUITY EARN");
    expect(names[5]).toBe("TSLA US EQUITY OMON");
    expect(names[6]).toBe("TSLA US EQUITY SEC");
    expect(names[7]).toBe("TSLA US EQUITY BOOK");
  });

  it("applies adaptive recency boost to user's recently executed commands", () => {
    // Without history, "A" prefers Tier 1 AAPL
    const aNormal = getCommandSuggestions("A");
    expect(aNormal[0].name).toBe("AAPL US EQUITY GP");

    // With recent AMD in history, AMD gets +350 recency boost and outranks AAPL
    const aBoosted = getCommandSuggestions("A", ["CHART AMD"]);
    expect(aBoosted[0].name).toBe("AMD US EQUITY GP");
  });
});

describe("CommandBar — Tier 1 Analytical Commands (DES, ANR, EARN, MOST, FXC, COMM)", () => {
  it("parses security-scoped Tier 1 commands with and without <GO>", () => {
    expect(parseCommand("AAPL US EQUITY DES")).toEqual({ command: "DES", ticker: "AAPL" });
    expect(parseCommand("AAPL US EQUITY DES <GO>")).toEqual({ command: "DES", ticker: "AAPL" });
    expect(parseCommand("MSFT US EQUITY ANR <GO>")).toEqual({ command: "ANR", ticker: "MSFT" });
    expect(parseCommand("NVDA US EQUITY EARN")).toEqual({ command: "EARN", ticker: "NVDA" });
    expect(parseCommand("CL1 COM")).toEqual({ command: "COMM" });
  });

  it("parses direct shortcut syntax for Tier 1 commands", () => {
    expect(parseCommand("DES NVDA")).toEqual({ command: "DES", ticker: "NVDA" });
    expect(parseCommand("ANR TSLA")).toEqual({ command: "ANR", ticker: "TSLA" });
    expect(parseCommand("EARN AAPL")).toEqual({ command: "EARN", ticker: "AAPL" });
    expect(parseCommand("MOST")).toEqual({ command: "MOST" });
    expect(parseCommand("MOV")).toEqual({ command: "MOST" });
    expect(parseCommand("FXC")).toEqual({ command: "FXC" });
    expect(parseCommand("COMM")).toEqual({ command: "COMM" });
  });

  it("provides autocomplete suggestions for Tier 1 commands", () => {
    const mostSuggestions = getCommandSuggestions("MOST");
    expect(mostSuggestions[0].name).toBe("MOST");

    const fxcSuggestions = getCommandSuggestions("FXC");
    expect(fxcSuggestions[0].name).toBe("FXC");

    const commSuggestions = getCommandSuggestions("COMM");
    expect(commSuggestions[0].name).toBe("COMM");

    const desMatches = getCommandSuggestions("DES ");
    expect(desMatches.map((m) => m.name)).toContain("DES AAPL");

    const anrMatches = getCommandSuggestions("ANR ");
    expect(anrMatches.map((m) => m.name)).toContain("ANR AAPL");

    const earnMatches = getCommandSuggestions("EARN ");
    expect(earnMatches.map((m) => m.name)).toContain("EARN AAPL");
  });
});

describe("CommandBar — Milestone 2A Commands (DVD, RV, TOP)", () => {
  it("parses security-scoped DVD and RV commands", () => {
    expect(parseCommand("AAPL US EQUITY DVD")).toEqual({ command: "DVD", ticker: "AAPL" });
    expect(parseCommand("JNJ US EQUITY DVD <GO>")).toEqual({ command: "DVD", ticker: "JNJ" });
    expect(parseCommand("AAPL US EQUITY RV <GO>")).toEqual({ command: "RV", ticker: "AAPL" });
    expect(parseCommand("NVDA US EQUITY PEERS")).toEqual({ command: "RV", ticker: "NVDA" });
  });

  it("parses direct shortcut syntax for DVD, RV, and TOP", () => {
    expect(parseCommand("DVD AAPL")).toEqual({ command: "DVD", ticker: "AAPL" });
    expect(parseCommand("DIVIDEND KO")).toEqual({ command: "DVD", ticker: "KO" });
    expect(parseCommand("RV MSFT")).toEqual({ command: "RV", ticker: "MSFT" });
    expect(parseCommand("PEERS NVDA")).toEqual({ command: "RV", ticker: "NVDA" });
    expect(parseCommand("TOP")).toEqual({ command: "NEWS", query: "" });
    expect(parseCommand("TOP TECH")).toEqual({ command: "NEWS", query: "TECH" });
    expect(parseCommand("TOP MACRO <GO>")).toEqual({ command: "NEWS", query: "MACRO" });
  });

  it("provides suggestions for DVD, RV, and TOP", () => {
    const dvdSuggestions = getCommandSuggestions("DVD");
    expect(dvdSuggestions[0].name).toBe("DVD");

    const rvSuggestions = getCommandSuggestions("RV");
    expect(rvSuggestions[0].name).toBe("RV");

    const topSuggestions = getCommandSuggestions("TOP");
    expect(topSuggestions[0].name).toBe("TOP");
  });
});

describe("CommandBar — Milestone 2B Commands (WIRP, FED, WBON, BOND)", () => {
  it("parses WIRP and FED interest rate probability commands", () => {
    expect(parseCommand("WIRP")).toEqual({ command: "WIRP" });
    expect(parseCommand("WIRP <GO>")).toEqual({ command: "WIRP" });
    expect(parseCommand("FED")).toEqual({ command: "WIRP" });
    expect(parseCommand("FED <GO>")).toEqual({ command: "WIRP" });
  });

  it("parses WBON and BOND sovereign bond matrix commands", () => {
    expect(parseCommand("WBON")).toEqual({ command: "WBON" });
    expect(parseCommand("WBON <GO>")).toEqual({ command: "WBON" });
    expect(parseCommand("BOND")).toEqual({ command: "WBON" });
    expect(parseCommand("BOND <GO>")).toEqual({ command: "WBON" });
  });

  it("provides autocomplete suggestions for WIRP and WBON", () => {
    const wirpSuggestions = getCommandSuggestions("WIRP");
    expect(wirpSuggestions[0].name).toBe("WIRP");

    const wbonSuggestions = getCommandSuggestions("WBON");
    expect(wbonSuggestions[0].name).toBe("WBON");

    const fedSuggestions = getCommandSuggestions("FED");
    expect(fedSuggestions[0].name).toBe("FED");
  });
});

describe("CommandBar — Milestone 2C Commands (CORR, VOL, VIX, HDS)", () => {
  it("parses CORR correlation matrix commands", () => {
    expect(parseCommand("CORR")).toEqual({ command: "CORR" });
    expect(parseCommand("CORR <GO>")).toEqual({ command: "CORR" });
  });

  it("parses VOL and VIX volatility commands", () => {
    expect(parseCommand("VOL")).toEqual({ command: "VOL" });
    expect(parseCommand("VOL <GO>")).toEqual({ command: "VOL" });
    expect(parseCommand("VIX")).toEqual({ command: "VOL" });
    expect(parseCommand("VIX <GO>")).toEqual({ command: "VOL" });
  });

  it("parses security-scoped and shortcut HDS commands", () => {
    expect(parseCommand("AAPL US EQUITY HDS")).toEqual({ command: "HDS", ticker: "AAPL" });
    expect(parseCommand("NVDA US EQUITY HDS <GO>")).toEqual({ command: "HDS", ticker: "NVDA" });
    expect(parseCommand("HDS TSLA")).toEqual({ command: "HDS", ticker: "TSLA" });
    expect(parseCommand("HOLDERS MSFT")).toEqual({ command: "HDS", ticker: "MSFT" });
  });

  it("provides autocomplete suggestions for Milestone 2C commands", () => {
    const corrSuggestions = getCommandSuggestions("CORR");
    expect(corrSuggestions[0].name).toBe("CORR");

    const volSuggestions = getCommandSuggestions("VOL");
    expect(volSuggestions[0].name).toBe("VOL");

    const vixSuggestions = getCommandSuggestions("VIX");
    expect(vixSuggestions[0].name).toBe("VIX");

    const hdsSuggestions = getCommandSuggestions("HDS");
    expect(hdsSuggestions[0].name).toBe("HDS");
  });
});

describe("CommandBar — Milestone 3 Commands (QR, TRADES)", () => {
  it("parses security-scoped and direct shortcut QR commands", () => {
    expect(parseCommand("AAPL US EQUITY QR")).toEqual({ command: "QR", symbol: "AAPL" });
    expect(parseCommand("NVDA US EQUITY QR <GO>")).toEqual({ command: "QR", symbol: "NVDA" });
    expect(parseCommand("BTC CRYPTO QR")).toEqual({ command: "QR", symbol: "BTCUSDT" });
    expect(parseCommand("QR ETHUSDT")).toEqual({ command: "QR", symbol: "ETHUSDT" });
    expect(parseCommand("TRADES AAPL")).toEqual({ command: "QR", symbol: "AAPL" });
    expect(parseCommand("QR")).toEqual({ command: "QR", symbol: "BTCUSDT" });
    expect(parseCommand("QR <GO>")).toEqual({ command: "QR", symbol: "BTCUSDT" });
  });

  it("provides autocomplete suggestions for QR", () => {
    const qrSuggestions = getCommandSuggestions("QR");
    expect(qrSuggestions[0].name).toBe("QR");

    const tradesSuggestions = getCommandSuggestions("TRADES");
    expect(tradesSuggestions[0].name).toBe("TRADES");
  });
});

describe("CommandBar — Milestone 6 Commands (SECF, FIND)", () => {
  it("parses SECF and FIND universal search commands", () => {
    expect(parseCommand("SECF")).toEqual({ command: "SECF" });
    expect(parseCommand("SECF <GO>")).toEqual({ command: "SECF" });
    expect(parseCommand("SECF AAPL")).toEqual({ command: "SECF", query: "AAPL" });
    expect(parseCommand("FIND SEMICONDUCTOR")).toEqual({ command: "SECF", query: "SEMICONDUCTOR" });
    expect(parseCommand("SEARCH BITCOIN")).toEqual({ command: "SECF", query: "BITCOIN" });
  });

  it("provides autocomplete suggestions for SECF and FIND", () => {
    const secfSuggestions = getCommandSuggestions("SECF");
    expect(secfSuggestions[0].name).toBe("SECF");

    const findSuggestions = getCommandSuggestions("FIND");
    expect(findSuggestions[0].name).toBe("FIND");
  });
});




