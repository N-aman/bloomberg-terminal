/// <reference lib="webworker" />

import {
  newBookState,
  loadSnapshot,
  applyBufferedEvents,
  handleEvent,
  type DepthEvent,
  type Snapshot,
  type BookState,
} from "../lib/reconciliation";
import { isEquitySymbol } from "../lib/providers/alpaca";

const BINANCE_STREAM_URL = "wss://stream.binance.com:9443/stream";

type DeltaOut = { symbol: string; side: "bid" | "ask"; price: number; quantity: number };

interface SymbolState {
  book: BookState;
  buffer: DepthEvent[];
  synced: boolean;
  isEquity: boolean;
  gapBackoff: { attempts: number; lastAttempt: number };
}

const symbols = new Map<string, SymbolState>(); // keyed by e.g. "btcusdt"
const pendingDeltas = new Map<string, DeltaOut>(); // key: `${symbol}:${side}:${price}`

function newSymbolState(isEquity = false): SymbolState {
  return {
    book: newBookState(),
    buffer: [],
    synced: false,
    isEquity,
    gapBackoff: { attempts: 0, lastAttempt: 0 },
  };
}

// Batching: flush delta updates at ~60fps (16ms) to conserve main-thread CPU cycles
let flushInterval: ReturnType<typeof setInterval> | null = null;

function flushPendingDeltas() {
  if (pendingDeltas.size === 0) return;
  self.postMessage({
    type: "delta",
    updates: Array.from(pendingDeltas.values()),
    timestamp: Date.now(),
  });
  pendingDeltas.clear();
}

function setLevel(
  symbol: string,
  state: SymbolState,
  side: "bid" | "ask",
  price: number,
  qty: number
) {
  const map = side === "bid" ? state.book.bids : state.book.asks;
  qty === 0 ? map.delete(price) : map.set(price, qty);
  pendingDeltas.set(`${symbol}:${side}:${price}`, { symbol, side, price, quantity: qty });
}

const BASE_DELAY = 2000, MAX_DELAY = 30000;
function backoffDelay(track: { attempts: number }) {
  return Math.min(BASE_DELAY * 2 ** track.attempts, MAX_DELAY);
}

async function fetchCryptoSnapshot(symbol: string): Promise<Snapshot> {
  const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=1000`);
  if (!res.ok) throw new Error(`Snapshot fetch failed for ${symbol}: ${res.status}`);
  return res.json();
}

function handleIncomingCryptoEvent(symbol: string, state: SymbolState, event: DepthEvent) {
  const result = handleEvent(state.book, event);
  if (result === "applied") {
    for (const [p, q] of event.b) setLevel(symbol, state, "bid", Number(p), Number(q));
    for (const [p, q] of event.a) setLevel(symbol, state, "ask", Number(p), Number(q));
  } else if (result === "gap") {
    triggerGapResync(symbol, state);
  }
}

function triggerGapResync(symbol: string, state: SymbolState) {
  const now = Date.now();
  if (now - state.gapBackoff.lastAttempt < backoffDelay(state.gapBackoff)) return;
  state.gapBackoff.lastAttempt = now;
  state.gapBackoff.attempts++;
  state.synced = false;
  state.buffer = [];
  self.postMessage({ type: "resync", symbol });
  syncFromSnapshot(symbol, state).catch((e) =>
    self.postMessage({ type: "error", symbol, message: String(e) })
  );
}

async function syncFromSnapshot(symbol: string, state: SymbolState) {
  if (state.isEquity) {
    // Equities are top-of-book only via Alpaca — no synthetic depth
    return;
  }

  // Crypto depth sync
  const snapshot = await fetchCryptoSnapshot(symbol);
  loadSnapshot(state.book, snapshot);

  const result = applyBufferedEvents(state.book, state.buffer);
  state.buffer = [];

  if (result === "gap") {
    return triggerGapResync(symbol, state);
  }

  for (const [price, qty] of state.book.bids) setLevel(symbol, state, "bid", price, qty);
  for (const [price, qty] of state.book.asks) setLevel(symbol, state, "ask", price, qty);

  state.synced = true;
  state.gapBackoff.attempts = 0;
}

// --- Binance WebSocket Connection (for crypto assets) ---
let ws: WebSocket | null = null;
let reqId = 1;
const reconnectBackoff = { attempts: 0, lastAttempt: 0 };
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isStopped = false;

function safeCloseBinance(socket: WebSocket | null) {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    try {
      socket.close(1000, "Normal Closure");
    } catch {}
  }
}

function connectBinance() {
  if (isStopped) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  safeCloseBinance(ws);

  const socket = new WebSocket(BINANCE_STREAM_URL);
  ws = socket;

  socket.onopen = () => {
    if (isStopped || ws !== socket) {
      safeCloseBinance(socket);
      return;
    }
    reconnectBackoff.attempts = 0;
    const cryptoKeys = Array.from(symbols.keys()).filter((s) => !symbols.get(s)?.isEquity);
    if (cryptoKeys.length > 0) {
      socket.send(JSON.stringify({ method: "SUBSCRIBE", params: cryptoKeys.map((s) => `${s}@depth`), id: reqId++ }));
      for (const symbol of cryptoKeys) {
        const state = symbols.get(symbol);
        if (state) setTimeout(() => syncFromSnapshot(symbol, state), 1000);
      }
    }
  };

  socket.onmessage = (msg) => {
    if (isStopped || ws !== socket) return;
    try {
      const parsed = JSON.parse(msg.data as string);
      if (!parsed.stream) return;
      const symbol = parsed.stream.split("@")[0];
      const state = symbols.get(symbol);
      if (!state || state.isEquity) return;
      const event: DepthEvent = parsed.data;
      state.synced ? handleIncomingCryptoEvent(symbol, state, event) : state.buffer.push(event);
    } catch {}
  };

  socket.onclose = () => {
    if (isStopped || ws !== socket) return;
    const hasCrypto = Array.from(symbols.values()).some((s) => !s.isEquity);
    if (hasCrypto) scheduleReconnect();
  };

  socket.onerror = () => {
    if (isStopped || ws !== socket) return;
    safeCloseBinance(socket);
    const hasCrypto = Array.from(symbols.values()).some((s) => !s.isEquity);
    if (hasCrypto) scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (isStopped) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectBackoff.attempts++;
  reconnectBackoff.lastAttempt = Date.now();
  for (const [symbol, state] of symbols) {
    if (!state.isEquity) {
      state.synced = false;
      state.buffer = [];
      state.book.bids.clear();
      state.book.asks.clear();
      self.postMessage({ type: "resync", symbol });
    }
  }
  const delay = backoffDelay(reconnectBackoff) + Math.random() * 500;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!isStopped) connectBinance();
  }, delay);
}

function subscribe(symbol: string) {
  const sym = symbol.toLowerCase();
  if (symbols.has(sym)) return;

  const isEq = isEquitySymbol(symbol);
  const state = newSymbolState(isEq);
  symbols.set(sym, state);

  if (!isEq) {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectBinance();
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: "SUBSCRIBE", params: [`${sym}@depth`], id: reqId++ }));
      setTimeout(() => syncFromSnapshot(sym, state), 1000);
    }
    // If ws.readyState is CONNECTING, ws.onopen will automatically iterate all symbols in the map and subscribe them
  }
}

function unsubscribe(symbol: string) {
  const sym = symbol.toLowerCase();
  const state = symbols.get(sym);
  if (!state) return;

  symbols.delete(sym);

  if (!state.isEquity && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method: "UNSUBSCRIBE", params: [`${sym}@depth`], id: reqId++ }));
  }

  // Clear un-flushed deltas for this symbol
  for (const key of pendingDeltas.keys()) {
    if (key.startsWith(`${sym}:`)) {
      pendingDeltas.delete(key);
    }
  }

  // If no remaining crypto subscriptions, cleanly disconnect WebSocket to conserve resources
  const hasRemainingCrypto = Array.from(symbols.values()).some((s) => !s.isEquity);
  if (!hasRemainingCrypto && ws) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    safeCloseBinance(ws);
    ws = null;
  }
}

self.onmessage = (event: MessageEvent) => {
  const msg = event.data;
  if (msg?.type === "start") {
    isStopped = false;
    if (!flushInterval) {
      flushInterval = setInterval(flushPendingDeltas, 16);
    }
    if (!ws) connectBinance();
  }
  if (msg?.type === "subscribe") subscribe(msg.symbol);
  if (msg?.type === "unsubscribe") unsubscribe(msg.symbol);
  if (msg?.type === "stop") {
    isStopped = true;
    if (flushInterval) {
      clearInterval(flushInterval);
      flushInterval = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    safeCloseBinance(ws);
    ws = null;
    symbols.clear();
    pendingDeltas.clear();
  }
};