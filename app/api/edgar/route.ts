import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchCompanyFilings, type CompanyFilings } from "@/lib/providers/edgar";

const CACHE_TTL_SECONDS = 3600; // 1 hour TTL
const TIMEOUT_MS = 8000;

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") || searchParams.get("symbol") || "AAPL").trim().toUpperCase();
  const formFilter = searchParams.get("form")?.trim().toUpperCase();

  const CACHE_KEY = `edgar:filings:v3:${ticker}`;
  const cached = await getCached<CompanyFilings>(CACHE_KEY);

  let companyData: CompanyFilings | null = null;

  if (cached && !cached.stale) {
    companyData = cached.value;
  } else {
    const upstream = withTimeout();
    try {
      companyData = await fetchCompanyFilings(ticker, upstream.signal);
      await setCached(CACHE_KEY, companyData, CACHE_TTL_SECONDS);
    } catch {
      if (cached) {
        companyData = { ...cached.value, stale: true };
      } else {
        return NextResponse.json(
          { error: `SEC EDGAR filings unavailable for ${ticker}.` },
          { status: 503 }
        );
      }
    } finally {
      upstream.clear();
    }
  }

  if (!companyData) {
    return NextResponse.json({ error: "No filings found." }, { status: 404 });
  }

  // Filter by form if requested (e.g. 10-K, 10-Q, 8-K, FORM 4)
  if (formFilter && formFilter !== "ALL") {
    const filtered = companyData.filings.filter((f) => {
      const formUpper = f.form.toUpperCase();
      if (formFilter === "4" || formFilter === "FORM 4" || formFilter === "INSIDER") {
        return formUpper === "4" || formUpper === "4/A" || formUpper === "FORM 4" || formUpper.startsWith("4") || formUpper === "144";
      }
      return formUpper === formFilter || formUpper.startsWith(formFilter);
    });
    return NextResponse.json({
      ...companyData,
      filings: filtered,
    });
  }

  return NextResponse.json(companyData);
}
