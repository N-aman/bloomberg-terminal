"use client";

import { useEffect, useState, useMemo, type RefObject } from "react";

export type EconomicEvent = {
  id: string;
  date: string;
  time?: string;
  title: string;
  category: "Growth" | "Inflation" | "Employment" | "Central Bank" | "Housing" | "Trade" | "Other";
  impact: "HIGH" | "MEDIUM" | "LOW";
  source: string;
};

export type CalendarData = {
  events: EconomicEvent[];
  range: { start: string; end: string };
  stale: boolean;
};

const CATEGORIES = [
  "ALL",
  "Central Bank",
  "Inflation",
  "Employment",
  "Growth",
  "Housing",
  "Trade",
] as const;

import PanelTitlebar from "@/components/ui/PanelTitlebar";

export default function EconomicCalendarPanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeImpact, setActiveImpact] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = () => {
    setStatus("loading");
    fetch("/api/calendar?days=30")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CalendarData>;
      })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => {
        setStatus("error");
      });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000); // 5-minute polling
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    return data.events.filter((ev) => {
      const matchCat = activeCategory === "ALL" || ev.category === activeCategory;
      const matchImp = activeImpact === "ALL" || ev.impact === activeImpact;
      const matchQ =
        !searchQuery ||
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.date.includes(searchQuery);
      return matchCat && matchImp && matchQ;
    });
  }, [data, activeCategory, activeImpact, searchQuery]);

  const impactBadge = (impact: EconomicEvent["impact"]) => {
    if (impact === "HIGH") {
      return (
        <span
          style={{
            color: "var(--color-red)",
            background: "rgba(255, 68, 68, 0.12)",
            border: "1px solid rgba(255, 68, 68, 0.3)",
            padding: "1px 6px",
            borderRadius: "2px",
            fontSize: "10px",
            fontWeight: 700,
          }}
        >
          ● HIGH
        </span>
      );
    }
    if (impact === "MEDIUM") {
      return (
        <span
          style={{
            color: "var(--accent)",
            background: "rgba(255, 180, 0, 0.12)",
            border: "1px solid rgba(255, 180, 0, 0.3)",
            padding: "1px 6px",
            borderRadius: "2px",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          ▲ MED
        </span>
      );
    }
    return (
      <span
        style={{
          color: "var(--muted)",
          background: "rgba(150, 150, 150, 0.08)",
          border: "1px solid rgba(150, 150, 150, 0.2)",
          padding: "1px 6px",
          borderRadius: "2px",
          fontSize: "10px",
        }}
      >
        LOW
      </span>
    );
  };

  const categoryBadge = (cat: EconomicEvent["category"]) => (
    <span
      style={{
        color: "var(--text)",
        background: "#16181b",
        border: "1px solid #23272d",
        padding: "1px 5px",
        borderRadius: "2px",
        fontSize: "10px",
      }}
    >
      {cat}
    </span>
  );

  return (
    <section
      className="economic-calendar-panel"
      aria-label="Bloomberg Macroeconomic Release Calendar"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="ECO // ECONOMIC RELEASE CALENDAR"
        title="MACROECONOMIC EVENTS & RELEASES"
        subtitle="NEXT 30 DAYS"
        sources="ST. LOUIS FED RELEASES"
        status={status}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="picker-label">IMPACT:</span>
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((imp) => (
            <button
              key={imp}
              type="button"
              className={activeImpact === imp ? "active" : ""}
              onClick={() => setActiveImpact(imp)}
            >
              {imp}
            </button>
          ))}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">
        {/* Filter Toolbar */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div className="fx-quick-pills">
            <span className="fx-quick-label">CATEGORY:</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`fx-pill${activeCategory === cat ? " fx-pill-active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="text"
              className="fx-search-input"
              style={{ width: "120px" }}
              placeholder="SEARCH (e.g. CPI)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <button type="button" className="fx-search-clear" onClick={loadData}>
              ↻ REFRESH
            </button>
          </div>
        </div>

        {/* Events Table */}
        {status === "loading" && !data ? (
          <p className="news-empty">Fetching upcoming macroeconomic release dates from FRED…</p>
        ) : filteredEvents.length === 0 ? (
          <p className="news-empty">No economic releases found matching the selected filters.</p>
        ) : (
          <div className="edgar-table-wrap">
            <table className="edgar-table">
              <thead>
                <tr>
                  <th style={{ width: "110px" }}>DATE</th>
                  <th style={{ width: "100px" }}>TIME</th>
                  <th style={{ width: "90px" }}>IMPACT</th>
                  <th style={{ width: "130px" }}>CATEGORY</th>
                  <th>EVENT / RELEASE TITLE</th>
                  <th style={{ width: "140px", textAlign: "right" }}>SOURCE</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev, idx) => (
                  <tr key={`${ev.id}-${ev.date}-${idx}`} className="edgar-row">
                    <td className="edgar-date-col" style={{ fontWeight: 700, color: "var(--text)" }}>
                      {ev.date}
                    </td>
                    <td className="edgar-date-col">{ev.time || "08:30 AM"}</td>
                    <td>{impactBadge(ev.impact)}</td>
                    <td>{categoryBadge(ev.category)}</td>
                    <td className="edgar-desc-col">
                      <span className="edgar-desc-text" style={{ color: "var(--text)", fontWeight: 500 }}>
                        {ev.title}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "10px" }}>
                      {ev.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
