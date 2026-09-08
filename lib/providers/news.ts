export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: string;
  snippet: string;
};

export type NewsProvider = (query: string) => Promise<NewsItem[]>;

export function newsQueryUrl(query: string) {
  return query ? `?q=${encodeURIComponent(query)}` : "";
}
