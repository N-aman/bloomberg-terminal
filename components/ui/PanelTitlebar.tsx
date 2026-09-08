"use client";

import React, { ReactNode } from "react";
import SimulatedBadge from "@/components/ui/SimulatedBadge";

export type PanelTitlebarProps = {
  kicker: string;
  title: string;
  subtitle?: string;
  sources?: string | string[];
  status?: "live" | "stale" | "loading" | "error" | "ready";
  simulated?: boolean;
  actions?: ReactNode;
  tickers?: string[];
  selectedTicker?: string;
  onSelectTicker?: (ticker: string) => void;
  inputTicker?: string;
  onInputTickerChange?: (val: string) => void;
  onTickerSubmit?: (e: React.FormEvent) => void;
  inputPlaceholder?: string;
  onRefresh?: () => void;
  children?: ReactNode;
};

export default function PanelTitlebar({
  kicker,
  title,
  subtitle,
  sources,
  status = "live",
  simulated = false,
  actions,
  tickers,
  selectedTicker,
  onSelectTicker,
  inputTicker,
  onInputTickerChange,
  onTickerSubmit,
  inputPlaceholder = "TICKER",
  onRefresh,
  children,
}: PanelTitlebarProps) {
  const sourcesText = Array.isArray(sources) ? sources.join(" · ") : sources;
  const hasRibbon = Boolean(tickers?.length || children || onTickerSubmit || onRefresh);

  return (
    <div className="panel-titlebar-container">
      {/* Primary Header Row */}
      <div className="panel-titlebar-main">
        <div className="panel-title-left">
          <span className="panel-kicker">{kicker}</span>
          <h2 className="panel-title">
            {title}
            {subtitle && <span className="panel-subtitle"> · {subtitle}</span>}
          </h2>
        </div>

        <div className="panel-title-right">
          {simulated && <SimulatedBadge simulated={true} />}
          {sourcesText && <span className="source-pill">{sourcesText}</span>}
          {status === "live" && <span className="status-live">● LIVE</span>}
          {status === "stale" && <span className="status-stale">⚠ STALE</span>}
          {status === "loading" && <span className="status-loading">LOADING…</span>}
          {status === "error" && <span className="status-error">OFFLINE</span>}
          {status === "ready" && <span className="status-live">● READY</span>}
          {actions}
        </div>
      </div>

      {/* Secondary Ticker / Quick-Filter Ribbon */}
      {hasRibbon && (
        <div className="panel-titlebar-ribbon">
          <div className="panel-ribbon-left">
            {tickers && tickers.length > 0 && (
              <div className="quick-tickers">
                <span className="picker-label">COMPANY:</span>
                {tickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={selectedTicker === t ? "active" : ""}
                    onClick={() => onSelectTicker?.(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            {children}
          </div>

          <div className="panel-ribbon-right">
            {onTickerSubmit && (
              <form onSubmit={onTickerSubmit} className="symbol-input-row">
                <input
                  type="text"
                  aria-label={`${title} ticker symbol`}
                  value={inputTicker ?? ""}
                  onChange={(e) => onInputTickerChange?.(e.target.value.toUpperCase())}
                  placeholder={inputPlaceholder}
                  className="symbol-input"
                />
                <button type="submit" aria-label={`Search ${title} ticker`} className="symbol-submit-btn">
                  GO
                </button>
              </form>
            )}

            {onRefresh && (
              <button
                type="button"
                className="symbol-submit-btn"
                style={{ padding: "0 6px", fontSize: "10px" }}
                onClick={onRefresh}
                title="Refresh panel data"
              >
                ↻
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
