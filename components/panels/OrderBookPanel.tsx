// components/panels/OrderBookPanel.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeSymbol, unsubscribeSymbol, readBook } from "@/lib/orderbook-worker-client";
import { isEquitySymbol, StockQuote } from "@/lib/providers/alpaca";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";

export default function OrderBookPanel({ symbol, onRemove }: { symbol: string; onRemove?: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const lastPaint = useRef(0);
    const [status, setStatus] = useState<"connecting" | "live" | "resyncing" | "error">("connecting");
    const [bbo, setBbo] = useState<{ bid: number | null; ask: number | null; spread: number | null }>({
        bid: null,
        ask: null,
        spread: null,
    });
    const [equityQuote, setEquityQuote] = useState<StockQuote | null>(null);
    const isEquity = isEquitySymbol(symbol);

    // ── EQUITIES TOP-OF-BOOK DATA PIPELINE ────────────────────────────
    useEffect(() => {
        if (!isEquity) return;

        let isMounted = true;
        setStatus("connecting");

        const loadQuote = () => {
            fetchJsonWithRetry<StockQuote>(`/api/quote?symbol=${encodeURIComponent(symbol)}`, undefined, {
                context: `PANEL:QUOTE:${symbol}`,
                retries: 2,
                initialDelayMs: 600,
            })
                .then((q) => {
                    if (!isMounted) return;
                    setEquityQuote(q);
                    setBbo({
                        bid: q.bidPrice,
                        ask: q.askPrice,
                        spread: q.spread,
                    });
                    setStatus("live");
                })
                .catch(() => {
                    if (!isMounted) return;
                    setStatus("error");
                });
        };

        loadQuote();
        const pollInterval = window.setInterval(loadQuote, 4000); // 4s polling fallback

        return () => {
            isMounted = false;
            window.clearInterval(pollInterval);
        };
    }, [symbol, isEquity]);

    // ── CRYPTO L2 DEPTH CANVAS PIPELINE (BINANCE) ────────────────────
    useEffect(() => {
        if (isEquity) return;

        subscribeSymbol(symbol);

        const statusTimer = window.setInterval(() => {
            const book = readBook(symbol);
            setStatus(book.stale ? "resyncing" : book.bids.size || book.asks.size ? "live" : "connecting");

            const bidsSorted = [...book.bids.entries()].sort((a, b) => b[0] - a[0]);
            const asksSorted = [...book.asks.entries()].sort((a, b) => a[0] - b[0]);
            const bestBid = bidsSorted[0]?.[0] ?? null;
            const bestAsk = asksSorted[0]?.[0] ?? null;
            const spread = bestBid !== null && bestAsk !== null ? Math.max(0, bestAsk - bestBid) : null;

            setBbo({ bid: bestBid, ask: bestAsk, spread });
        }, 200);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        function draw(now: number) {
            if (now - lastPaint.current < 16) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            lastPaint.current = now;

            const book = readBook(symbol);
            ctx!.clearRect(0, 0, rect.width, rect.height);

            const bidsSorted = [...book.bids.entries()].sort((a, b) => b[0] - a[0]).slice(0, 15);
            const asksSorted = [...book.asks.entries()].sort((a, b) => a[0] - b[0]).slice(0, 15);

            let bidCum = 0;
            const bidsCumulative = bidsSorted.map(([price, qty]) => {
                bidCum += qty;
                return { price, qty, cum: bidCum };
            });
            let askCum = 0;
            const asksCumulative = asksSorted.map(([price, qty]) => {
                askCum += qty;
                return { price, qty, cum: askCum };
            });

            const maxCum = Math.max(bidCum, askCum, 1);
            const rowH = 15;
            const topPad = 4;

            bidsCumulative.forEach(({ price, cum }, i) => {
                const w = (cum / maxCum) * (rect.width / 2);
                const y = topPad + i * rowH;
                ctx!.fillStyle = "#3ecf6e33";
                ctx!.fillRect(rect.width / 2 - w, y, w, rowH - 1);
                ctx!.fillStyle = "#d8dee3";
                ctx!.font = "10px monospace";
                ctx!.fillText(price.toFixed(2), 4, y + 10);
            });

            asksCumulative.forEach(({ price, cum }, i) => {
                const w = (cum / maxCum) * (rect.width / 2);
                const y = topPad + i * rowH;
                ctx!.fillStyle = "#e2555533";
                ctx!.fillRect(rect.width / 2, y, w, rowH - 1);
                ctx!.fillStyle = "#d8dee3";
                ctx!.font = "10px monospace";
                ctx!.fillText(price.toFixed(2), rect.width / 2 + 4, y + 10);
            });

            if (book.stale) {
                ctx!.fillStyle = "#e0a835";
                ctx!.font = "11px monospace";
                ctx!.fillText("resyncing…", rect.width / 2 - 32, rect.height - 8);
            }

            rafRef.current = requestAnimationFrame(draw);
        }

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.clearInterval(statusTimer);
            unsubscribeSymbol(symbol);
        };
    }, [symbol, isEquity]);

    return (
        <section className="order-book-panel" aria-label={`${symbol.toUpperCase()} order book`}>
            <header className="panel-header">
                <div>
                    <span className="panel-kicker">
                        {isEquity ? "US EQUITIES // TOP OF BOOK (IEX)" : "SPOT CRYPTO // L2 DEPTH (BINANCE)"}
                    </span>
                    <h2>{symbol.toUpperCase()}</h2>
                </div>
                <div className="panel-header-actions">
                    <span className={`stream-status stream-status-${status}`}>
                        <span className="status-dot" aria-hidden="true" />
                        {status}
                    </span>
                    {onRemove && <button className="panel-remove" type="button" onClick={onRemove} aria-label={`Remove ${symbol.toUpperCase()}`}>&times;</button>}
                </div>
            </header>

            {/* Dedicated Top BBO & Spread Banner */}
            <div className="orderbook-bbo-strip">
                <span className="orderbook-bbo-val bid">
                    BID {bbo.bid !== null ? (isEquity ? `$${bbo.bid.toFixed(2)}` : bbo.bid.toFixed(2)) : "—"}
                </span>
                <span className="orderbook-bbo-val spread">
                    SPREAD {bbo.spread !== null ? (isEquity ? `$${bbo.spread.toFixed(2)}` : bbo.spread.toFixed(2)) : "—"}
                </span>
                <span className="orderbook-bbo-val ask">
                    ASK {bbo.ask !== null ? (isEquity ? `$${bbo.ask.toFixed(2)}` : bbo.ask.toFixed(2)) : "—"}
                </span>
            </div>

            {isEquity ? (
                /* Equities Top-of-Book Honest Readout (No fake L2 ladder) */
                <div className="equity-tob-container" style={{ padding: "16px", minHeight: 235, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div style={{ background: "rgba(62, 207, 110, 0.08)", border: "1px solid rgba(62, 207, 110, 0.25)", padding: "12px", borderRadius: "2px" }}>
                            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Best Bid (IEX)</div>
                            <div style={{ fontSize: "24px", fontWeight: 700, color: "#3ecf6e", marginTop: "4px" }}>
                                {equityQuote ? `$${equityQuote.bidPrice.toFixed(2)}` : "—"}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                                Size: <strong style={{ color: "#d8dee3" }}>{equityQuote ? equityQuote.bidSize.toLocaleString() : "—"} shares</strong>
                            </div>
                        </div>

                        <div style={{ background: "rgba(226, 85, 85, 0.08)", border: "1px solid rgba(226, 85, 85, 0.25)", padding: "12px", borderRadius: "2px" }}>
                            <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Best Ask (IEX)</div>
                            <div style={{ fontSize: "24px", fontWeight: 700, color: "#e25555", marginTop: "4px" }}>
                                {equityQuote ? `$${equityQuote.askPrice.toFixed(2)}` : "—"}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                                Size: <strong style={{ color: "#d8dee3" }}>{equityQuote ? equityQuote.askSize.toLocaleString() : "—"} shares</strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-header)", border: "1px solid var(--border)", padding: "10px 14px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "11px" }}>
                        <div>
                            <span style={{ color: "var(--muted)", display: "block" }}>MID PRICE</span>
                            <strong style={{ color: "var(--accent)", fontSize: "13px" }}>
                                {equityQuote ? `$${equityQuote.lastPrice.toFixed(2)}` : "—"}
                            </strong>
                        </div>
                        <div>
                            <span style={{ color: "var(--muted)", display: "block" }}>SPREAD (BPS)</span>
                            <strong style={{ color: "var(--text)", fontSize: "13px" }}>
                                {equityQuote ? `${equityQuote.spreadBps.toFixed(1)} bps` : "—"}
                            </strong>
                        </div>
                        <div>
                            <span style={{ color: "var(--muted)", display: "block" }}>FEED</span>
                            <strong style={{ color: "#3ecf6e", fontSize: "13px" }}>Alpaca IEX BBO</strong>
                        </div>
                    </div>
                </div>
            ) : (
                /* Crypto Multi-Level L2 Depth Chart */
                <div className="depth-canvas-wrap">
                    <canvas ref={canvasRef} style={{ width: "100%", height: 235 }} />
                </div>
            )}

            <footer className="panel-footer">
                {isEquity ? (
                    <>
                        <span><i className="legend-swatch legend-bid" /> IEX Bid</span>
                        <span><i className="legend-swatch legend-ask" /> IEX Ask</span>
                        <span className="panel-footer-note">Top-of-Book · Real IEX Feed</span>
                    </>
                ) : (
                    <>
                        <span><i className="legend-swatch legend-bid" /> bids</span>
                        <span><i className="legend-swatch legend-ask" /> asks</span>
                        <span className="panel-footer-note">Binance L2 · updates / 16ms</span>
                    </>
                )}
            </footer>
        </section>
    );
}