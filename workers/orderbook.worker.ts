/// <reference lib="webworker" />

const STREAM_URL = "wss://stream.binance.com:9443/stream";

type DepthEvent = { U: number; u: number; b: [string, string][]; a: [string, string][] };
type Snapshot = { lastUpdateId: number; bids: [string, string][]; asks: [string, string][] };
type DeltaOut = { symbol: string; side: "bid" | "ask"; price: number; quantity: number };

interface SymbolState {
  bids: Map<number, number>;
  asks: Map<number, number>;
  lastUpdateId: number;
  buffer: DepthEvent[];
  synced: boolean;
  gapBackoff: { attempts: number; lastAttempt: number };
}

const symbols = new Map<string, SymbolState>(); // keyed by e.g. "btcusdt"
const pendingDeltas = new Map<string, DeltaOut>(); // key: `${symbol}:${side}:${price}`

function newSymbolState(): SymbolState {
  return { bids: new Map(), asks: new Map(), lastUpdateId: 0, buffer: [], synced: false, gapBackoff: { attempts: 0, lastAttempt: 0 } };
}

// --- Batching (1.2.3), now symbol-tagged ---
setInterval(() => {
  if (pendingDeltas.size === 0) return;
  self.postMessage({ type: "delta", updates: Array.from(pendingDeltas.values()), timestamp: Date.now() });
  pendingDeltas.clear();
}, 16);

function setLevel(symbol: string, state: SymbolState, side: "bid" | "ask", price: number, qty: number) {
  const map = side === "bid" ? state.bids : state.asks;
  qty === 0 ? map.delete(price) : map.set(price, qty);
  pendingDeltas.set(`${symbol}:${side}:${price}`, { symbol, side, price, quantity: qty });
}

function applyDelta(symbol: string, state: SymbolState, e: DepthEvent) {
  for (const [p, q] of e.b) setLevel(symbol, state, "bid", Number(p), Number(q));
  for (const [p, q] of e.a) setLevel(symbol, state, "ask", Number(p), Number(q));
  state.lastUpdateId = e.u;
}

const BASE_DELAY = 2000, MAX_DELAY = 30000;
function backoffDelay(track: { attempts: number }) {
  return Math.min(BASE_DELAY * 2 ** track.attempts, MAX_DELAY);
}

async function fetchSnapshot(symbol: string): Promise<Snapshot> {
  const res = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=1000`);
  if (!res.ok) throw new Error(`Snapshot fetch failed for ${symbol}: ${res.status}`);
  return res.json();
}

function handleEvent(symbol: string, state: SymbolState, event: DepthEvent) {
  if (event.U !== state.lastUpdateId + 1) return triggerGapResync(symbol, state); // 1.1.5
  applyDelta(symbol, state, event);
}

function triggerGapResync(symbol: string, state: SymbolState) {
  const now = Date.now();
  if (now - state.gapBackoff.lastAttempt < backoffDelay(state.gapBackoff)) return; // 1.2.5, per-symbol
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
  const snapshot = await fetchSnapshot(symbol);
  state.bids = new Map(snapshot.bids.map(([p, q]) => [Number(p), Number(q)]));
  state.asks = new Map(snapshot.asks.map(([p, q]) => [Number(p), Number(q)]));
  state.lastUpdateId = snapshot.lastUpdateId;
  state.buffer = state.buffer.filter((e) => e.u > snapshot.lastUpdateId); // 1.1.3

  const first = state.buffer[0];
  if (first && !(first.U <= snapshot.lastUpdateId + 1 && first.u >= snapshot.lastUpdateId + 1)) {
    state.buffer = [];
    return triggerGapResync(symbol, state); // 1.1.4
  }
  if (first) {
    applyDelta(symbol, state, first);
    state.buffer.slice(1).forEach((e) => handleEvent(symbol, state, e));
  }
  state.buffer = [];
  state.synced = true;
  state.gapBackoff.attempts = 0;
}

// --- Connection (single shared WS, dynamic subscribe) ---
let ws: WebSocket | null = null;
let reqId = 1;
const reconnectBackoff = { attempts: 0, lastAttempt: 0 }; // ONE shared track - connection-level

function connect() {
  ws = new WebSocket(STREAM_URL);

  ws.onopen = () => {
    reconnectBackoff.attempts = 0;
    // Re-subscribe to everything the user had active before a drop.
    if (symbols.size > 0) {
      ws?.send(JSON.stringify({ method: "SUBSCRIBE", params: [...symbols.keys()].map((s) => `${s}@depth`), id: reqId++ }));
      for (const [symbol, state] of symbols) {
        setTimeout(() => syncFromSnapshot(symbol, state), 1000);
      }
    }
  };

  ws.onmessage = (msg) => {
    const parsed = JSON.parse(msg.data as string);
    if (!parsed.stream) return; // subscribe/unsubscribe ack, not a depth event
    const symbol = parsed.stream.split("@")[0]; // "btcusdt@depth" -> "btcusdt"
    const state = symbols.get(symbol);
    if (!state) return; // user unsubscribed since this was in flight
    const event: DepthEvent = parsed.data;
    state.synced ? handleEvent(symbol, state, event) : state.buffer.push(event);
  };

  ws.onclose = () => symbols.size > 0 && scheduleReconnect();
  ws.onerror = () => ws?.close();
}

function scheduleReconnect() {
  // 1.2.4 - connection drop resyncs EVERY currently-active symbol, not just one.
  reconnectBackoff.attempts++;
  reconnectBackoff.lastAttempt = Date.now();
  for (const [symbol, state] of symbols) {
    state.synced = false;
    state.buffer = [];
    state.bids.clear();
    state.asks.clear();
    self.postMessage({ type: "resync", symbol });
  }
  setTimeout(connect, backoffDelay(reconnectBackoff));
}

function subscribe(symbol: string) {
  const sym = symbol.toLowerCase();
  if (symbols.has(sym)) return;
  symbols.set(sym, newSymbolState());
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method: "SUBSCRIBE", params: [`${sym}@depth`], id: reqId++ }));
    setTimeout(() => syncFromSnapshot(sym, symbols.get(sym)!), 1000);
  }
}

function unsubscribe(symbol: string) {
  const sym = symbol.toLowerCase();
  if (!symbols.has(sym)) return;
  symbols.delete(sym);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method: "UNSUBSCRIBE", params: [`${sym}@depth`], id: reqId++ }));
  }
}

self.onmessage = (event: MessageEvent) => {
  const msg = event.data;
  if (msg?.type === "start" && !ws) connect();
  if (msg?.type === "subscribe") subscribe(msg.symbol);
  if (msg?.type === "unsubscribe") unsubscribe(msg.symbol);
  if (msg?.type === "stop") { ws?.close(); ws = null; symbols.clear(); }
};