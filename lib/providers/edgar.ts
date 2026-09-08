/**
 * SEC EDGAR Corporate Filings Provider
 * Queries official SEC.gov Submissions API (https://data.sec.gov/submissions/CIK{cik}.json)
 * and dynamic company tickers directory (https://www.sec.gov/files/company_tickers.json).
 * Strict SEC compliance: Custom User-Agent header and rate-limit safety.
 */

import { getCached, setCached } from "../cache";
import { logger } from "../logger";

export type EdgarFiling = {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
  description: string;
  fileNumber: string;
  size: number;
  url: string;
  interactiveUrl?: string;
};

export type CompanyFilings = {
  ticker: string;
  name: string;
  cik: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  filings: EdgarFiling[];
  stale?: boolean;
  unavailable?: boolean;
};

export const TOP_CIK_MAP: Record<string, { cik: string; name: string }> = {
  AAPL:  { cik: "0000320193", name: "Apple Inc." },
  NVDA:  { cik: "0001045810", name: "NVIDIA CORP" },
  TSLA:  { cik: "0001318605", name: "Tesla, Inc." },
  MSFT:  { cik: "0000789019", name: "MICROSOFT CORP" },
  AMZN:  { cik: "0001018724", name: "AMAZON COM INC" },
  GOOGL: { cik: "0001652044", name: "Alphabet Inc." },
  GOOG:  { cik: "0001652044", name: "Alphabet Inc." },
  META:  { cik: "0001326801", name: "Meta Platforms, Inc." },
  AMD:   { cik: "0000002488", name: "ADVANCED MICRO DEVICES INC" },
  INTC:  { cik: "0000050863", name: "INTEL CORP" },
  NFLX:  { cik: "0001065280", name: "NETFLIX INC" },
  BRK:   { cik: "0001067983", name: "BERKSHIRE HATHAWAY INC" },
  JPM:   { cik: "0000019617", name: "JPMORGAN CHASE & CO" },
  BAC:   { cik: "0000070858", name: "BANK OF AMERICA CORP /DE/" },
  V:     { cik: "0001403161", name: "VISA INC." },
  WMT:   { cik: "0000104169", name: "WALMART INC." },
  DIS:   { cik: "0001744489", name: "Walt Disney Co" },
  PLTR:  { cik: "0001321655", name: "Palantir Technologies Inc." },
  CRM:   { cik: "0001108524", name: "Salesforce, Inc." },
  SPY:   { cik: "0000884394", name: "SPDR S&P 500 ETF TRUST" },
  QQQ:   { cik: "0001067839", name: "INVESCO QQQ TRUST" },
};

const SEC_USER_AGENT = "BloombergTerminal/1.0 (contact@bloomberg-terminal.dev)";
const CACHE_KEY_TICKER_MAP = "edgar:ticker-cik-map:v1";
const CIK_MAP_TTL_SECONDS = 86400; // 24 hours

type SecCompanyTickerItem = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SecSubmissionsResponse = {
  cik: string;
  name: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      act: string[];
      form: string[];
      fileNumber: string[];
      filmNumber: string[];
      items: string[];
      size: number[];
      isXBRL: number[];
      isInlineXBRL: number[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
};

/**
 * Fetches and caches the complete SEC EDGAR ticker directory (10,000+ public companies).
 */
export async function fetchCompanyTickerMap(): Promise<Record<string, { cik: string; name: string }>> {
  const cached = await getCached<Record<string, { cik: string; name: string }>>(CACHE_KEY_TICKER_MAP);
  if (cached && !cached.stale) {
    return cached.value;
  }

  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: {
        "User-Agent": SEC_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(`SEC company_tickers.json returned ${res.status}`);

    const raw = (await res.json()) as Record<string, SecCompanyTickerItem>;
    const map: Record<string, { cik: string; name: string }> = { ...TOP_CIK_MAP };

    for (const item of Object.values(raw)) {
      if (item && item.ticker && item.cik_str) {
        const sym = item.ticker.trim().toUpperCase();
        const paddedCik = String(item.cik_str).padStart(10, "0");
        map[sym] = {
          cik: paddedCik,
          name: item.title,
        };
      }
    }

    await setCached(CACHE_KEY_TICKER_MAP, map, CIK_MAP_TTL_SECONDS);
    return map;
  } catch (err) {
    logger.warn("EDGAR", "Failed to fetch dynamic company_tickers.json, using static fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    if (cached) return cached.value;
    return TOP_CIK_MAP;
  }
}

/**
 * Resolves any US public equity ticker to its official 10-digit SEC CIK and legal name.
 */
export async function lookupCik(ticker: string): Promise<{ cik: string; name: string } | null> {
  const sym = ticker.trim().toUpperCase();
  if (TOP_CIK_MAP[sym]) {
    return TOP_CIK_MAP[sym];
  }

  const dynamicMap = await fetchCompanyTickerMap();
  return dynamicMap[sym] || null;
}

export async function fetchCompanyFilings(ticker: string, signal?: AbortSignal): Promise<CompanyFilings> {
  const sym = ticker.trim().toUpperCase();
  const cikInfo = await lookupCik(sym);

  if (!cikInfo) {
    return {
      ticker: sym,
      name: `${sym} Corp.`,
      cik: "",
      filings: [],
      unavailable: true,
    };
  }

  const { cik, name } = cikInfo;

  try {
    const paddedCik = cik.padStart(10, "0");
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": SEC_USER_AGENT,
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) throw new Error(`SEC EDGAR returned ${response.status}`);
    const data = (await response.json()) as SecSubmissionsResponse;
    const r = data.filings.recent;

    const cikNumber = String(Number(data.cik));
    const filings: EdgarFiling[] = [];

    const total = Math.min(200, r.form.length);
    for (let i = 0; i < total; i++) {
      const accession = r.accessionNumber[i];
      const form = r.form[i] ?? "FILING";
      const primaryDoc = r.primaryDocument[i] ?? "";
      const isInline = r.isInlineXBRL ? r.isInlineXBRL[i] === 1 : false;
      const isHtm = primaryDoc
        ? primaryDoc.toLowerCase().endsWith(".htm") || primaryDoc.toLowerCase().endsWith(".html")
        : false;

      const cleanAccession = accession.replace(/-/g, "");
      const docUrl = `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${cleanAccession}/${primaryDoc}`;
      const targetUrl =
        isInline && isHtm
          ? `https://www.sec.gov/ix?doc=/Archives/edgar/data/${cikNumber}/${cleanAccession}/${primaryDoc}`
          : docUrl;

      filings.push({
        accessionNumber: accession,
        filingDate: r.filingDate[i] ?? "",
        reportDate: r.reportDate[i] ?? r.filingDate[i] ?? "",
        form,
        primaryDocument: primaryDoc,
        description: r.primaryDocDescription[i] || `${form} Filing`,
        fileNumber: r.fileNumber[i] ?? "",
        size: r.size[i] ?? 0,
        url: targetUrl,
      });
    }

    return {
      ticker: sym,
      name: data.name || name,
      cik: data.cik,
      sic: data.sic,
      sicDescription: data.sicDescription,
      fiscalYearEnd: data.fiscalYearEnd,
      filings,
      stale: false,
    };
  } catch (err) {
    logger.error("EDGAR", `Failed fetching filings for ${sym}`, err instanceof Error ? err.message : String(err));
    return {
      ticker: sym,
      name,
      cik,
      filings: [],
      unavailable: true,
    };
  }
}
