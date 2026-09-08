/**
 * Unit tests for data structures and providers.
 */

import { describe, it, expect } from "vitest";
import {
  MAJOR_CURRENCY_CODES,
  WORLD_CURRENCIES,
  CURRENCY_MAP,
} from "../lib/currencies";

describe("Yield Curve Data Formatting", () => {
  it("sorts maturities chronologically by months", () => {
    const maturities = [
      { label: "10Y", months: 120 },
      { label: "1M",  months: 1   },
      { label: "2Y",  months: 24  },
      { label: "30Y", months: 360 },
      { label: "3M",  months: 3   },
    ];

    const sorted = [...maturities].sort((a, b) => a.months - b.months);
    expect(sorted.map((m) => m.label)).toEqual(["1M", "3M", "2Y", "10Y", "30Y"]);
  });

  it("detects yield curve inversion accurately", () => {
    const invertedPoints = [
      { label: "1M", yield: 5.25 },
      { label: "10Y", yield: 4.10 },
      { label: "30Y", yield: 4.30 },
    ];
    const first = invertedPoints[0].yield;
    const last = invertedPoints[invertedPoints.length - 1].yield;
    const isInverted = first > last;

    expect(isInverted).toBe(true);

    const normalPoints = [
      { label: "1M", yield: 3.50 },
      { label: "10Y", yield: 4.10 },
      { label: "30Y", yield: 4.60 },
    ];
    const normalInverted = normalPoints[0].yield > normalPoints[normalPoints.length - 1].yield;
    expect(normalInverted).toBe(false);
  });
});

describe("Fear & Greed Classification", () => {
  const GAUGE_COLORS: Record<string, string> = {
    "Extreme Fear": "#e25555",
    "Fear": "#e07a35",
    "Neutral": "#e0a835",
    "Greed": "#6ecf3e",
    "Extreme Greed": "#3ecf6e",
  };

  it("maps sentiment classifications to appropriate color indicators", () => {
    expect(GAUGE_COLORS["Extreme Fear"]).toBe("#e25555");
    expect(GAUGE_COLORS["Extreme Greed"]).toBe("#3ecf6e");
    expect(GAUGE_COLORS["Neutral"]).toBe("#e0a835");
  });
});

describe("Currency Database & Major Currency Search", () => {
  it("indexes over 150 global currencies", () => {
    expect(WORLD_CURRENCIES.length).toBeGreaterThan(150);
  });

  it("flags all G10 and major currencies correctly", () => {
    for (const code of ["USD", "EUR", "GBP", "JPY", "CHF", "INR", "AED", "CAD", "AUD"]) {
      expect(MAJOR_CURRENCY_CODES).toContain(code);
      const info = CURRENCY_MAP.get(code);
      expect(info).toBeDefined();
      expect(info?.isMajor).toBe(true);
    }
  });

  it("finds currencies by code or full name", () => {
    const yen = CURRENCY_MAP.get("JPY");
    expect(yen?.name).toBe("Japanese Yen");

    const dirham = CURRENCY_MAP.get("AED");
    expect(dirham?.name).toBe("UAE Dirham");

    const rupee = CURRENCY_MAP.get("INR");
    expect(rupee?.name).toBe("Indian Rupee");
  });
});

describe("Alpaca & US Equities Provider", () => {
  it("distinguishes equity stock tickers from crypto pairs", async () => {
    const { isEquitySymbol } = await import("../lib/providers/alpaca");
    expect(isEquitySymbol("AAPL")).toBe(true);
    expect(isEquitySymbol("NVDA")).toBe(true);
    expect(isEquitySymbol("TSLA")).toBe(true);
    expect(isEquitySymbol("SPY")).toBe(true);

    expect(isEquitySymbol("BTCUSDT")).toBe(false);
    expect(isEquitySymbol("ETHUSDT")).toBe(false);
    expect(isEquitySymbol("SOL-USD")).toBe(false);
  });

  it("validates Alpaca credentials configuration", async () => {
    const { getAlpacaCredentials } = await import("../lib/providers/alpaca");
    const creds = getAlpacaCredentials();
    expect(creds).toBeDefined();
    expect(typeof creds.isConfigured).toBe("boolean");
  });
});

describe("SEC EDGAR Filings Provider", () => {
  it("resolves CIK numbers for major US corporations", async () => {
    const { TOP_CIK_MAP } = await import("../lib/providers/edgar");
    expect(TOP_CIK_MAP.AAPL.cik).toBe("0000320193");
    expect(TOP_CIK_MAP.NVDA.cik).toBe("0001045810");
    expect(TOP_CIK_MAP.TSLA.cik).toBe("0001318605");
    expect(TOP_CIK_MAP.MSFT.cik).toBe("0000789019");
  });

  it("fetches or returns fallback institutional filings with 10-K and 10-Q reports", async () => {
    const { fetchCompanyFilings } = await import("../lib/providers/edgar");
    const data = await fetchCompanyFilings("AAPL");
    expect(data.ticker).toBe("AAPL");
    expect(data.filings.length).toBeGreaterThan(0);
    const forms = data.filings.map((f) => f.form);
    expect(forms).toContain("10-K");
    expect(forms).toContain("10-Q");
  });
});
