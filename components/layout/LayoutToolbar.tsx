"use client";

interface LayoutToolbarProps {
  gridCols: 1 | 2 | 3;
  onChangeLayout: (cols: 1 | 2 | 3) => void;
  showPanelManager: boolean;
  onTogglePanelManager: () => void;
  isWatchlistVisible: boolean;
  onToggleWatchlist: () => void;
}

export default function LayoutToolbar({
  gridCols,
  onChangeLayout,
  showPanelManager,
  onTogglePanelManager,
  isWatchlistVisible,
  onToggleWatchlist,
}: LayoutToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span style={{ fontSize: "10px", color: "var(--accent)", fontWeight: 700 }}>
          LAYOUT:
        </span>
        <button
          type="button"
          className={`macro-tf-btn${gridCols === 2 ? " macro-tf-active" : ""}`}
          style={{ fontSize: "10px", padding: "2px 8px" }}
          onClick={() => onChangeLayout(2)}
          title="2-Column Dashboard Grid"
        >
          2-COL TILES
        </button>
        <button
          type="button"
          className={`macro-tf-btn${gridCols === 3 ? " macro-tf-active" : ""}`}
          style={{ fontSize: "10px", padding: "2px 8px" }}
          onClick={() => onChangeLayout(3)}
          title="3-Column Dense Grid"
        >
          3-COL TILES
        </button>
        <button
          type="button"
          className={`macro-tf-btn${gridCols === 1 ? " macro-tf-active" : ""}`}
          style={{ fontSize: "10px", padding: "2px 8px" }}
          onClick={() => onChangeLayout(1)}
          title="1-Column Full Width Tiles"
        >
          1-COL (EXPANDED)
        </button>
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          type="button"
          className={`macro-tf-btn${showPanelManager ? " macro-tf-active" : ""}`}
          style={{ fontSize: "10px", padding: "2px 8px" }}
          onClick={onTogglePanelManager}
          title="Show/Hide Panels"
        >
          ⊞ PANELS
        </button>
        <button
          type="button"
          className={`macro-tf-btn${isWatchlistVisible ? " macro-tf-active" : ""}`}
          style={{ fontSize: "10px", padding: "2px 8px" }}
          onClick={onToggleWatchlist}
          title="Toggle Watchlist Sidebar"
        >
          {isWatchlistVisible ? "◧ HIDE WATCHLIST" : "◨ SHOW WATCHLIST"}
        </button>
      </div>
    </div>
  );
}

