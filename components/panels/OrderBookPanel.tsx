// components/panels/OrderBookPanel.tsx
"use client";
import { useEffect, useRef } from "react";
import { subscribeSymbol, unsubscribeSymbol, readBook } from "@/lib/orderbook-worker-client";

export default function OrderBookPanel({ symbol }: { symbol: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>(0);
    const lastPaint = useRef(0);

    useEffect(() => {
        subscribeSymbol(symbol);

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
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
            ctx.clearRect(0, 0, rect.width, rect.height);

            const bidsSorted = [...book.bids.entries()].sort((a, b) => b[0] - a[0]).slice(0, 15);
            const asksSorted = [...book.asks.entries()].sort((a, b) => a[0] - b[0]).slice(0, 15);

            // Cumulative fill: each row's bar = its own qty + everything closer to the spread.
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

            const maxCum = Math.max(bidCum, askCum, 1); // shared scale so both sides are comparable
            const rowH = 14;

            bidsCumulative.forEach(({ price, cum }, i) => {
                const w = (cum / maxCum) * (rect.width / 2);
                ctx.fillStyle = "#3ecf6e33";
                ctx.fillRect(rect.width / 2 - w, i * rowH, w, rowH - 1);
                ctx.fillStyle = "#d8dee3";
                ctx.fillText(price.toFixed(2), 4, i * rowH + 10);
            });

            asksCumulative.forEach(({ price, cum }, i) => {
                const w = (cum / maxCum) * (rect.width / 2);
                ctx.fillStyle = "#e2555533";
                ctx.fillRect(rect.width / 2, i * rowH, w, rowH - 1);
                ctx.fillStyle = "#d8dee3";
                ctx.fillText(price.toFixed(2), rect.width / 2 + 4, i * rowH + 10);
            });

            // Best bid/ask + spread overlay (task 1.4.5)
            const bestBid = bidsSorted[0]?.[0];
            const bestAsk = asksSorted[0]?.[0];
            if (bestBid !== undefined && bestAsk !== undefined) {
                const spread = bestAsk - bestBid;
                ctx.fillStyle = "#e0a835";
                ctx.fillText(
                    `bid ${bestBid.toFixed(2)}  ask ${bestAsk.toFixed(2)}  spread ${spread.toFixed(2)}`,
                    rect.width / 2 - 90,
                    12
                );
            }

            if (book.stale) {
                ctx.fillStyle = "#e0a835";
                ctx.fillText("resyncing…", rect.width / 2 - 30, rect.height - 6);
            }

            rafRef.current = requestAnimationFrame(draw);
        }

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(rafRef.current);
            unsubscribeSymbol(symbol);
        };
    }, [symbol]);

    return (
        <div style={{ border: "1px solid var(--border)", padding: 4 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{symbol.toUpperCase()}</div>
            <canvas ref={canvasRef} style={{ width: "100%", height: 240 }} />
        </div>
    );
}