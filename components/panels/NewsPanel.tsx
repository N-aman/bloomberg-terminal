"use client";

import { useEffect, useState } from "react";
import type { EnrichedNewsItem } from "@/app/api/news/route";

type NewsResponse = {
  items?: EnrichedNewsItem[];
  provider?: string;
  stale?: boolean;
  simulated?: boolean;
  error?: string;
};

const POLL_INTERVAL_MS = 90_000;

const CHANNELS = [
  { id: "ALL", label: "ALL" },
  { id: "TECH", label: "TECH" },
  { id: "MACRO", label: "MACRO" },
  { id: "FX", label: "FX" },
  { id: "CRYPTO", label: "CRYPTO" },
  { id: "ENERGY", label: "ENERGY" },
] as const;

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "JUST NOW";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return isoString.slice(0, 10);
  }
}

import PanelTitlebar from "@/components/ui/PanelTitlebar";

export default function NewsPanel({
  query = "",
  initialCategory = "ALL",
  panelRef,
}: {
  query?: string;
  initialCategory?: string;
  panelRef?: React.RefObject<HTMLElement | null>;
}) {
  const [items, setItems] = useState<EnrichedNewsItem[]>([]);
  const [provider, setProvider] = useState("loading");
  const [simulated, setSimulated] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialCategory.toUpperCase());
  const [searchQuery, setSearchQuery] = useState(query);

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory.toUpperCase());
    }
  }, [initialCategory]);

  const fetchNews = () => {
    setProvider("loading");
    setError("");

    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (activeCategory && activeCategory !== "ALL") params.set("category", activeCategory);

    fetch(`/api/news?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as NewsResponse;
        if (!response.ok) throw new Error(data.error ?? "News request failed");
        return data;
      })
      .then((data) => {
        setItems(data.items ?? []);
        setProvider(data.stale ? "delayed" : (data.provider ?? "live"));
        setSimulated(Boolean(data.simulated));
        setError("");
      })
      .catch((requestError: unknown) => {
        if ((requestError as { name?: string }).name !== "AbortError") {
          setItems([]);
          setProvider("unavailable");
          setSimulated(false);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "News request failed"
          );
        }
      });
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [searchQuery, activeCategory]);

  const categoryColor = (cat?: string) => {
    switch (cat) {
      case "TECH":
        return { text: "#00c8ff", bg: "rgba(0, 200, 255, 0.1)" };
      case "MACRO":
        return { text: "var(--accent)", bg: "rgba(255, 180, 0, 0.1)" };
      case "FX":
        return { text: "var(--bid)", bg: "rgba(0, 200, 115, 0.1)" };
      case "CRYPTO":
        return { text: "#ff9900", bg: "rgba(255, 153, 0, 0.1)" };
      case "ENERGY":
        return { text: "var(--ask)", bg: "rgba(255, 68, 68, 0.1)" };
      default:
        return { text: "var(--muted)", bg: "#16181b" };
    }
  };

  return (
    <section className="news-panel" aria-label="News headlines" ref={panelRef as React.RefObject<HTMLElement>}>
      <PanelTitlebar
        kicker="TOP // BLOOMBERG INSTITUTIONAL NEWS WIRE"
        title="MARKET HEADLINES"
        subtitle={`${items.length} WIRE RELEASES`}
        sources="RSS NEWSFEED / PR NEWSWIRE"
        status={provider === "live" ? "live" : provider === "delayed" ? "stale" : "loading"}
        simulated={simulated}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="picker-label">CHANNEL:</span>
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={activeCategory === ch.id ? "active" : ""}
              onClick={() => setActiveCategory(ch.id)}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">
        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
          <input
            type="text"
            className="fx-search-input"
            style={{ width: "140px" }}
            aria-label="Filter news headlines"
            placeholder="FILTER NEWS"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="fx-search-clear" onClick={() => setSearchQuery("")}>
              CLEAR
            </button>
          )}
          <button type="button" className="fx-search-clear" onClick={fetchNews}>
            ↻ REFRESH
          </button>
        </div>

      {error ? <p className="news-empty">{error}</p> : null}

      {!error && provider === "loading" && items.length === 0 ? (
        <p className="news-empty">Loading institutional wire headlines…</p>
      ) : null}

      {!error && items.length === 0 && provider !== "loading" ? (
        <p className="news-empty">No headlines available matching current filter.</p>
      ) : null}

      {items.length > 0 && (
        <div className="news-list">
          {items.map((item) => {
            const catStyle = categoryColor(item.category);
            return (
              <article className="news-item" key={item.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "2px",
                      color: catStyle.text,
                      background: catStyle.bg,
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    {item.category || "WIRE"}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                    {item.source} · {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  {item.title}
                </a>
                {item.snippet ? (
                  <p style={{ marginTop: "4px", fontSize: "11px", color: "var(--text)" }}>
                    {item.snippet}
                  </p>
                ) : null}
              </article>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
}
