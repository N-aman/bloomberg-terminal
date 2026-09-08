export type FredSeries = {
  id: string;
  title: string;
  units: string;
  frequency: string;
  lastUpdated: string;
  observations: { date: string; value: number | null }[];
};

type FredSearchResponse = {
  seriess?: { id: string; title: string; units: string; frequency: string }[];
};

type FredObservationsResponse = {
  observations?: { date: string; value: string }[];
};

const FRED_URL = "https://api.stlouisfed.org/fred";

function apiUrl(path: string, params: Record<string, string>) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error("FRED_API_KEY is not configured");
  const searchParams = new URLSearchParams({ ...params, api_key: apiKey, file_type: "json" });
  return `${FRED_URL}/${path}?${searchParams}`;
}

export async function searchFredSeries(query: string, signal: AbortSignal) {
  const response = await fetch(apiUrl("series/search", { search_text: query }), { signal });
  if (!response.ok) throw new Error(`FRED search returned ${response.status}`);
  const data = await response.json() as FredSearchResponse;
  return (data.seriess ?? []).slice(0, 12).map((series) => ({
    id: series.id,
    title: series.title,
    units: series.units,
    frequency: series.frequency,
  }));
}

export async function fetchFredSeries(seriesId: string, signal: AbortSignal): Promise<FredSeries> {
  const [metadataResponse, observationsResponse] = await Promise.all([
    fetch(apiUrl("series", { series_id: seriesId }), { signal }),
    // Fetch latest observations in descending order (newest first) up to 1200 data points
    fetch(apiUrl("series/observations", { series_id: seriesId, sort_order: "desc", limit: "1200" }), { signal }),
  ]);
  if (!metadataResponse.ok || !observationsResponse.ok) throw new Error("FRED series request failed");

  const metadata = await metadataResponse.json() as { seriess?: { title: string; units: string; frequency: string; last_updated: string }[] };
  const observations = await observationsResponse.json() as FredObservationsResponse;

  // Filter valid numbers and reverse to chronological order (oldest -> newest, ending today)
  const validObservations = (observations.observations ?? [])
    .map((observation) => ({
      date: observation.date,
      value: observation.value === "." ? null : Number(observation.value),
    }))
    .filter((observation) => observation.value !== null && !isNaN(observation.value as number))
    .reverse();

  return {
    id: seriesId,
    title: metadata.seriess?.[0]?.title ?? seriesId,
    units: metadata.seriess?.[0]?.units ?? "",
    frequency: metadata.seriess?.[0]?.frequency ?? "",
    lastUpdated: metadata.seriess?.[0]?.last_updated ?? "",
    observations: validObservations,
  };
}
