/**
 * Alpaca Worker Client
 * Dispatches live equity trade, quote, and aggregate bar streams from the background Worker to React listeners.
 */
"use client";

export type LiveAlpacaQuote = {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  timestamp: string;
};

export type LiveAlpacaTrade = {
  symbol: string;
  price: number;
  size: number;
  timestamp: string;
  exchange: string;
};

export type LiveAlpacaBar = {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
};

type QuoteListener = (quote: LiveAlpacaQuote) => void;
type TradeListener = (trade: LiveAlpacaTrade) => void;
type BarListener = (bar: LiveAlpacaBar) => void;

let worker: Worker | null = null;
const quoteListeners = new Map<string, Set<QuoteListener>>();
const tradeListeners = new Map<string, Set<TradeListener>>();
const barListeners = new Map<string, Set<BarListener>>();

export function getAlpacaWorker(): Worker | null {
  if (typeof window === "undefined") return null;

  if (!worker) {
    worker = new Worker(new URL("../workers/alpaca.worker.ts", import.meta.url));

    // Request client credentials token from API
    fetch("/api/quote?symbol=AAPL")
      .catch(() => {});

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "alpaca_batch") {
        if (Array.isArray(msg.quotes)) {
          for (const q of msg.quotes) {
            const sym = q.S?.toUpperCase();
            const set = quoteListeners.get(sym);
            if (set) {
              const liveQuote: LiveAlpacaQuote = {
                symbol: sym,
                bidPrice: q.bp,
                bidSize: q.bs,
                askPrice: q.ap,
                askSize: q.as,
                timestamp: q.t,
              };
              set.forEach((cb) => cb(liveQuote));
            }
          }
        }

        if (Array.isArray(msg.trades)) {
          for (const t of msg.trades) {
            const sym = t.S?.toUpperCase();
            const set = tradeListeners.get(sym);
            if (set) {
              const liveTrade: LiveAlpacaTrade = {
                symbol: sym,
                price: t.p,
                size: t.s,
                timestamp: t.t,
                exchange: t.x || "IEX",
              };
              set.forEach((cb) => cb(liveTrade));
            }
          }
        }

        if (Array.isArray(msg.bars)) {
          for (const b of msg.bars) {
            const sym = b.S?.toUpperCase();
            const set = barListeners.get(sym);
            if (set) {
              const liveBar: LiveAlpacaBar = {
                symbol: sym,
                open: b.o,
                high: b.h,
                low: b.l,
                close: b.c,
                volume: b.v,
                timestamp: b.t,
              };
              set.forEach((cb) => cb(liveBar));
            }
          }
        }
      }
    };
  }

  return worker;
}

export function subscribeAlpacaSymbol(symbol: string) {
  const w = getAlpacaWorker();
  w?.postMessage({ type: "subscribe", symbol });
}

export function unsubscribeAlpacaSymbol(symbol: string) {
  const w = getAlpacaWorker();
  w?.postMessage({ type: "unsubscribe", symbol });
}

export function onAlpacaQuote(symbol: string, callback: QuoteListener): () => void {
  const sym = symbol.trim().toUpperCase();
  if (!quoteListeners.has(sym)) quoteListeners.set(sym, new Set());
  quoteListeners.get(sym)!.add(callback);
  subscribeAlpacaSymbol(sym);

  return () => {
    const set = quoteListeners.get(sym);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        quoteListeners.delete(sym);
        unsubscribeAlpacaSymbol(sym);
      }
    }
  };
}

export function onAlpacaTrade(symbol: string, callback: TradeListener): () => void {
  const sym = symbol.trim().toUpperCase();
  if (!tradeListeners.has(sym)) tradeListeners.set(sym, new Set());
  tradeListeners.get(sym)!.add(callback);
  subscribeAlpacaSymbol(sym);

  return () => {
    const set = tradeListeners.get(sym);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        tradeListeners.delete(sym);
        unsubscribeAlpacaSymbol(sym);
      }
    }
  };
}

export function onAlpacaBar(symbol: string, callback: BarListener): () => void {
  const sym = symbol.trim().toUpperCase();
  if (!barListeners.has(sym)) barListeners.set(sym, new Set());
  barListeners.get(sym)!.add(callback);
  subscribeAlpacaSymbol(sym);

  return () => {
    const set = barListeners.get(sym);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        barListeners.delete(sym);
        unsubscribeAlpacaSymbol(sym);
      }
    }
  };
}

