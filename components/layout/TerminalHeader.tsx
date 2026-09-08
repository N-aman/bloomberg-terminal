"use client";

import { useEffect, useState } from "react";

export default function TerminalHeader() {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    function updateClock() {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString("en-US", { hour12: false }));
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="terminal-header" style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "var(--accent)", letterSpacing: "1px" }}>
            BLOOMBERG PROFESSIONAL // DESK TERMINAL
          </h1>
          <span className="terminal-subhead" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            REAL-TIME MULTI-ASSET MARKET SURVEILLANCE & QUANT ANALYTICS
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
          <span className="terminal-badge" style={{ color: "var(--bid)", border: "1px solid var(--bid)", padding: "1px 6px", fontSize: "10px" }}>
            ● LIVE FEED
          </span>
          <span style={{ color: "var(--accent)" }}>{timeStr || "00:00:00"} UTC</span>
        </div>
      </div>
    </header>
  );
}

