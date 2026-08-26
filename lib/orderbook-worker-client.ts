// lib/orderbook-worker-client.ts
type BookLevel = Map<number, number>;
type SymbolBook = { bids: BookLevel; asks: BookLevel; stale: boolean };

const books = new Map<string, SymbolBook>(); // shared main-thread mirror, NOT React state
let worker: Worker | null = null;
const listeners = new Set<() => void>(); // notify panels a frame is ready to read

function ensureBook(symbol: string): SymbolBook {
  let b = books.get(symbol);
  if (!b) { b = { bids: new Map(), asks: new Map(), stale: false }; books.set(symbol, b); }
  return b;
}

export function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/orderbook.worker.ts", import.meta.url));
    worker.postMessage({ type: "start" });

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "delta") {
        for (const d of msg.updates) {
          const book = ensureBook(d.symbol);
          const map = d.side === "bid" ? book.bids : book.asks;
          d.quantity === 0 ? map.delete(d.price) : map.set(d.price, d.quantity);
        }
      }
      if (msg.type === "resync") ensureBook(msg.symbol).stale = true;
      if (msg.type === "error") console.error(`[orderbook:${msg.symbol}]`, msg.message);
      // Once resync completes, the next batch of deltas naturally repopulates
      // the book - clear `stale` once we see fresh deltas for that symbol.
      if (msg.type === "delta") {
        for (const d of msg.updates) ensureBook(d.symbol).stale = false;
      }
    };
  }
  return worker;
}

export function subscribeSymbol(symbol: string) {
  getWorker().postMessage({ type: "subscribe", symbol: symbol.toLowerCase() });
}

export function unsubscribeSymbol(symbol: string) {
  getWorker().postMessage({ type: "unsubscribe", symbol: symbol.toLowerCase() });
}

export function readBook(symbol: string): SymbolBook {
  return ensureBook(symbol.toLowerCase());
}