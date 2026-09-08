"use client";

import OrderBookPanel from "@/components/panels/OrderBookPanel";

interface WatchlistColumnProps {
  symbols: string[];
  symbolInput: string;
  onSymbolInputChange: (val: string) => void;
  onAddSymbol: (sym?: string) => void;
  onRemoveSymbol: (sym: string) => void;
  tradableSymbols: Set<string>;
}

export default function WatchlistColumn({
  symbols,
  symbolInput,
  onSymbolInputChange,
  onAddSymbol,
  onRemoveSymbol,
}: WatchlistColumnProps) {
  return (
    <aside className="watchlist-column" aria-label="Watchlist and Real-time Order Book">
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => onSymbolInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddSymbol();
            }
          }}
          placeholder="ADD TICKER (e.g. SOLUSDT / AAPL)"
          style={{
            flex: 1,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            padding: "4px 8px",
            outline: "none",
          }}
        />
        <button
          type="button"
          className="macro-tf-btn"
          style={{ fontSize: "10px", padding: "4px 8px" }}
          onClick={() => onAddSymbol()}
        >
          + ADD
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {symbols.map((sym) => (
          <div key={sym} className="terminal-window" style={{ height: "auto" }}>
            <OrderBookPanel symbol={sym} onRemove={() => onRemoveSymbol(sym)} />
          </div>
        ))}
      </div>
    </aside>
  );
}

