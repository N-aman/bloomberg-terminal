"use client";

import { PANEL_REGISTRY } from "@/config/panels";

interface PanelManagerDrawerProps {
  hiddenPanels: Set<string>;
  onTogglePanel: (panelId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export default function PanelManagerDrawer({
  hiddenPanels,
  onTogglePanel,
  onShowAll,
  onHideAll,
}: PanelManagerDrawerProps) {
  return (
    <div
      style={{
        background: "var(--panel-bg)",
        border: "1px solid var(--accent)",
        padding: "12px",
        marginBottom: "12px",
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: "10px", color: "var(--accent)", fontWeight: 700, marginRight: "8px" }}>
        VISIBLE PANELS:
      </span>
      {PANEL_REGISTRY.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`macro-tf-btn${!hiddenPanels.has(p.id) ? " macro-tf-active" : ""}`}
          style={{ fontSize: "9px", padding: "2px 6px" }}
          onClick={() => onTogglePanel(p.id)}
          title={p.fullLabel}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        className="macro-tf-btn"
        style={{ fontSize: "9px", padding: "2px 6px", marginLeft: "8px" }}
        onClick={onShowAll}
        title="Show all panels"
      >
        SHOW ALL
      </button>
      <button
        type="button"
        className="macro-tf-btn"
        style={{ fontSize: "9px", padding: "2px 6px" }}
        onClick={onHideAll}
        title="Hide all panels"
      >
        HIDE ALL
      </button>
    </div>
  );
}

