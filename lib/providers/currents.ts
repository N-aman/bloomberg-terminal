import type { NewsItem } from "./news";

const CURRENTS_URL = "https://api.currentsapi.services/v1/search";

export async function fetchCurrentsNews(query: string, signal: AbortSignal): Promise<NewsItem[]> {
  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) throw new Error("CURRENTS_API_KEY is not configured");

  const params = new URLSearchParams({ language: "en" });
  if (query) params.set("keywords", query);
  const response = await fetch(`${CURRENTS_URL}?${params}`, {
    headers: { Authorization: apiKey },
    signal,
  });
  if (!response.ok) throw new Error(`Currents returned ${response.status}`);

  const data = await response.json() as {
    news?: { id?: string; title?: string; description?: string; url?: string; published?: string; author?: string }[];
  };

  return (data.news ?? [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      id: `currents-${item.id ?? item.url}`,
      title: item.title!,
      source: item.author || "Currents",
      url: item.url!,
      timestamp: item.published ?? new Date(0).toISOString(),
      snippet: item.description ?? "",
    }));
}
