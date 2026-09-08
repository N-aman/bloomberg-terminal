"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { onAlpacaTrade } from "@/lib/alpaca-worker-client";
import { subscribeBinanceTrade, type BinanceTrade } from "@/lib/binance-trade-client";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

export type TradePrint = {
  id: string;
  time: string;
  price: number;
  size: number;
  value: number;
  side: "BUY" | "SELL";
  isBlockTrade: boolean;
};

const POPULAR_SYMBOLS = ["BTCUSDT", "ETHUSDT", "AAPL", "NVDA", "TSLA", "SPY"] as const;

export default function TimeAndSalesPanel({
  initialSymbol = "BTCUSDT",
  panelRef,
}: {
  initialSymbol?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [inputVal, setInputVal] = useState(initialSymbol.toUpperCase());
  const [trades, setTrades] = useState<TradePrint[]>([]);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [priceChangeDirection, setPriceChangeDirection] = useState<"up" | "down" | "flat">("flat");
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [stats, setStats] = useState({ high: 0, low: 0, vwap: 0, volume: 0 });

  useEffect(() => {
    setSymbol(initialSymbol.toUpperCase());
    setInputVal(initialSymbol.toUpperCase());
  }, [initialSymbol]);

  // Connect live trade stream (Binance WebSocket for crypto, Alpaca WebSocket for equities)
  useEffect(() => {
    setTrades([]);
    setStatus("connecting");

    const isCrypto = symbol.endsWith("USDT") || symbol === "BTC" || symbol === "ETH";

    if (isCrypto) {
      const unsubscribe = subscribeBinanceTrade(
        symbol,
        (trade) => {
          const price = trade.price;
          const size = trade.size;
          const value = trade.value;

          setLastPrice((prev) => {
            if (prev > 0) {
              if (price > prev) setPriceChangeDirection("up");
              else if (price < prev) setPriceChangeDirection("down");
            }
            return price;
          });

          setTrades((prev) => [trade, ...prev.slice(0, 49)]);

          setStats((prev) => ({
            high: prev.high === 0 ? price : Math.max(prev.high, price),
            low: prev.low === 0 ? price : Math.min(prev.low, price),
            vwap: prev.vwap === 0 ? price : (prev.vwap * prev.volume + value) / (prev.volume + size),
            volume: prev.volume + size,
          }));
        },
        (newStatus) => {
          setStatus(newStatus);
        }
      );

      return () => {
        unsubscribe();
      };
    } else {
      // Real US Equities Time & Sales Tape from Alpaca IEX Stream
      setStatus("connecting");
      let isDisposed = false;

      // Initial quote to prime last price
      fetchJsonWithRetry<any>(`/api/quote?symbol=${encodeURIComponent(symbol)}`, undefined, {
        context: `PANEL:QR:${symbol}`,
        retries: 2,
        initialDelayMs: 500,
      })
        .then((q) => {
          if (isDisposed) return;
          if (q?.lastPrice) {
            setLastPrice(q.lastPrice);
            setStats((prev) => ({
              ...prev,
              high: prev.high === 0 ? q.lastPrice : Math.max(prev.high, q.lastPrice),
              low: prev.low === 0 ? q.lastPrice : Math.min(prev.low, q.lastPrice),
            }));
            setStatus("connected");
          }
        })
        .catch(() => {});

      // Live Alpaca WebSocket Trade Stream listener
      const unsubscribeTrade = onAlpacaTrade(symbol, (trade) => {
        if (isDisposed) return;
        setStatus("connected");
        const price = trade.price;
        const size = trade.size;
        const value = price * size;
        const date = new Date(trade.timestamp);
        const timeStr = `${date.toTimeString().split(" ")[0]}.${String(date.getMilliseconds()).padStart(3, "0")}`;

        if (typeof window !== "undefined") {
          (window as any).__terminal_ws_ticks = ((window as any).__terminal_ws_ticks || 0) + 1;
          (window as any).__terminal_trade_ticks = ((window as any).__terminal_trade_ticks || 0) + 1;
        }

        setLastPrice((prev) => {
          if (prev > 0) {
            if (price > prev) setPriceChangeDirection("up");
            else if (price < prev) setPriceChangeDirection("down");
          }
          return price;
        });

        const newTrade: TradePrint = {
          id: `${Date.now()}-${Math.random()}`,
          time: timeStr,
          price,
          size,
          value,
          side: "BUY", // IEX tape prints
          isBlockTrade: value > 100000,
        };

        setTrades((prev) => [newTrade, ...prev.slice(0, 49)]);

        setStats((prev) => ({
          high: prev.high === 0 ? price : Math.max(prev.high, price),
          low: prev.low === 0 ? price : Math.min(prev.low, price),
          vwap: prev.vwap === 0 ? price : (prev.vwap * prev.volume + value) / (prev.volume + size),
          volume: prev.volume + size,
        }));
      });

      return () => {
        isDisposed = true;
        unsubscribeTrade();
      };
    }
  }, [symbol]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim().toUpperCase();
    if (clean && clean !== symbol) {
      setSymbol(clean);
    }
  };

  return (
    <section
      className="tape-panel"
      aria-label="Bloomberg Real-Time Time and Sales Trade Tape"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="QR // TIME & SALES REAL-TIME TRADE TAPE"
        title={`TRADE FEED: ${symbol}`}
        subtitle="MILLISECOND EXECUTION AUDIT"
        sources="IEX & BINANCE TICK FEED"
        status={status === "connected" ? "live" : "loading"}
        tickers={POPULAR_SYMBOLS as unknown as string[]}
        selectedTicker={symbol}
        onSelectTicker={(t) => {
          setSymbol(t);
          setInputVal(t);
        }}
        inputTicker={inputVal}
        onInputTickerChange={setInputVal}
        onTickerSubmit={handleSubmit}
      />

      <div className="panel-content-body">

      {/* Top Ticker Tape Bar */}
      <div
        style={{
          padding: "10px 12px",
          background: "#0c0d0f",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>LAST PRICE:</span>
          <span
            style={{
              fontSize: "22px",
              fontFamily: "var(--font-mono)",
              fontWeight: 800,
              color:
                priceChangeDirection === "up"
                  ? "var(--bid)"
                  : priceChangeDirection === "down"
                  ? "var(--ask)"
                  : "var(--text)",
              transition: "color 0.15s ease",
            }}
          >
            ${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: priceChangeDirection === "up" ? "var(--bid)" : "var(--ask)",
            }}
          >
            {priceChangeDirection === "up" ? "▲ UPTICK" : priceChangeDirection === "down" ? "▼ DOWNTICK" : "—"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
          <div>
            <span style={{ color: "var(--muted)" }}>HIGH: </span>
            <span style={{ color: "var(--bid)", fontWeight: 700 }}>${stats.high.toFixed(2)}</span>
          </div>
          <div>
            <span style={{ color: "var(--muted)" }}>LOW: </span>
            <span style={{ color: "var(--ask)", fontWeight: 700 }}>${stats.low.toFixed(2)}</span>
          </div>
          <div>
            <span style={{ color: "var(--muted)" }}>VWAP: </span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>${stats.vwap.toFixed(2)}</span>
          </div>
          <div>
            <span style={{ color: "var(--muted)" }}>TICKS: </span>
            <span style={{ color: "var(--text)", fontWeight: 700 }}>{trades.length}</span>
          </div>
        </div>
      </div>

      {/* Real-time Time & Sales Execution Table */}
      <div style={{ padding: "12px" }}>
        <div className="edgar-table-wrap" style={{ maxHeight: "240px", overflowY: "auto" }}>
          <table className="edgar-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>TIME (UTC)</th>
                <th style={{ textAlign: "right", width: "110px" }}>PRICE ($)</th>
                <th style={{ textAlign: "right", width: "90px" }}>SIZE</th>
                <th style={{ textAlign: "right", width: "120px" }}>NOTIONAL VALUE</th>
                <th style={{ textAlign: "right", width: "80px" }}>SIDE</th>
                <th style={{ textAlign: "right", width: "100px" }}>COND</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "20px" }}>
                    LISTENING FOR REAL-TIME TICKS ON {symbol}...
                  </td>
                </tr>
              ) : (
                trades.map((t, idx) => {
                  const isBuy = t.side === "BUY";
                  return (
                    <tr
                      key={t.id}
                      className="edgar-row"
                      style={{
                        background:
                          idx === 0
                            ? isBuy
                              ? "rgba(0, 200, 115, 0.12)"
                              : "rgba(255, 68, 68, 0.12)"
                            : undefined,
                      }}
                    >
                      <td className="edgar-date-col" style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                        {t.time}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color: isBuy ? "var(--bid)" : "var(--ask)",
                        }}
                      >
                        ${t.price.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text)" }}>
                        {t.size.toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                        ${t.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: "2px",
                            color: isBuy ? "var(--bid)" : "var(--ask)",
                            background: isBuy ? "rgba(0, 200, 115, 0.1)" : "rgba(255, 68, 68, 0.1)",
                          }}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {t.isBlockTrade ? (
                          <span
                            style={{
                              fontSize: "8px",
                              fontWeight: 800,
                              padding: "1px 4px",
                              borderRadius: "2px",
                              background: "var(--accent)",
                              color: "#000",
                            }}
                          >
                            BLOCK
                          </span>
                        ) : (
                          <span style={{ fontSize: "9px", color: "var(--muted)" }}>REGULAR</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
);
}

