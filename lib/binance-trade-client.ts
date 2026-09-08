/**
 * Binance Trade Stream Client
 * Manages resilient singleton WebSocket connections for real-time crypto trade prints.
 * Features 3000ms teardown debounce across layout switches and automatic exponential backoff.
 */
"use client";

export type BinanceTrade = {
  id: string;
  time: string;
  price: number;
  size: number;
  value: number;
  side: "BUY" | "SELL";
  isBlockTrade: boolean;
};

type TradeCallback = (trade: BinanceTrade) => void;
type StatusCallback = (status: "connected" | "connecting" | "disconnected") => void;

interface StreamEntry {
  ws: WebSocket | null;
  listeners: Set<TradeCallback>;
  statusListeners: Set<StatusCallback>;
  status: "connected" | "connecting" | "disconnected";
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  teardownTimeout: ReturnType<typeof setTimeout> | null;
  watchdogInterval: ReturnType<typeof setInterval> | null;
  attempts: number;
  lastTradeTime: number;
}

const streams = new Map<string, StreamEntry>();

function safeClose(socket: WebSocket | null) {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    try {
      socket.close(1000, "Clean close");
    } catch {}
  }
}

function getOrCreateEntry(cleanSym: string): StreamEntry {
  let entry = streams.get(cleanSym);
  if (!entry) {
    entry = {
      ws: null,
      listeners: new Set(),
      statusListeners: new Set(),
      status: "connecting",
      reconnectTimeout: null,
      teardownTimeout: null,
      watchdogInterval: null,
      attempts: 0,
      lastTradeTime: Date.now(),
    };
    streams.set(cleanSym, entry);
  }
  return entry;
}

function notifyStatus(entry: StreamEntry, status: "connected" | "connecting" | "disconnected") {
  entry.status = status;
  entry.statusListeners.forEach((cb) => cb(status));
}

function connectStream(cleanSym: string) {
  const entry = streams.get(cleanSym);
  if (!entry || entry.listeners.size === 0) return;

  if (entry.reconnectTimeout) {
    clearTimeout(entry.reconnectTimeout);
    entry.reconnectTimeout = null;
  }
  safeClose(entry.ws);

  notifyStatus(entry, "connecting");

  try {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${cleanSym}@trade`);
    entry.ws = ws;

    ws.onopen = () => {
      if (entry.ws !== ws) {
        safeClose(ws);
        return;
      }
      entry.attempts = 0;
      entry.lastTradeTime = Date.now();
      notifyStatus(entry, "connected");
    };

    ws.onmessage = (event) => {
      if (entry.ws !== ws) return;
      try {
        const data = JSON.parse(event.data);
        if (!data.p || !data.q) return;

        const price = parseFloat(data.p);
        const size = parseFloat(data.q);
        const value = price * size;
        const side: "BUY" | "SELL" = data.m ? "SELL" : "BUY";
        const date = new Date(data.T || Date.now());
        const timeStr = `${date.toTimeString().split(" ")[0]}.${String(date.getMilliseconds()).padStart(3, "0")}`;

        entry.lastTradeTime = Date.now();

        if (typeof window !== "undefined") {
          (window as any).__terminal_ws_ticks = ((window as any).__terminal_ws_ticks || 0) + 1;
          (window as any).__terminal_trade_ticks = ((window as any).__terminal_trade_ticks || 0) + 1;
        }

        const trade: BinanceTrade = {
          id: `${data.t || Date.now()}-${Math.random()}`,
          time: timeStr,
          price,
          size,
          value,
          side,
          isBlockTrade: value > 100000,
        };

        entry.listeners.forEach((cb) => cb(trade));
      } catch {}
    };

    ws.onerror = () => {
      if (entry.ws !== ws) return;
      notifyStatus(entry, "disconnected");
      safeClose(ws);
      scheduleReconnect(cleanSym);
    };

    ws.onclose = () => {
      if (entry.ws !== ws) return;
      notifyStatus(entry, "disconnected");
      scheduleReconnect(cleanSym);
    };
  } catch {
    notifyStatus(entry, "disconnected");
    scheduleReconnect(cleanSym);
  }

  // Activity watchdog
  if (!entry.watchdogInterval) {
    entry.watchdogInterval = setInterval(() => {
      if (entry.ws && entry.ws.readyState === WebSocket.OPEN && Date.now() - entry.lastTradeTime > 45000) {
        console.warn(`[BinanceTradeClient] Watchdog: No ticks on ${cleanSym} for 45s, reconnecting...`);
        connectStream(cleanSym);
      }
    }, 15000);
  }
}

function scheduleReconnect(cleanSym: string) {
  const entry = streams.get(cleanSym);
  if (!entry || entry.listeners.size === 0) return;

  if (entry.reconnectTimeout) clearTimeout(entry.reconnectTimeout);
  entry.attempts++;
  const delay = Math.min(1000 * 2 ** (entry.attempts - 1), 16000) + Math.random() * 500;
  entry.reconnectTimeout = setTimeout(() => {
    connectStream(cleanSym);
  }, delay);
}

export function subscribeBinanceTrade(
  symbol: string,
  onTrade: TradeCallback,
  onStatusChange?: StatusCallback
): () => void {
  if (typeof window === "undefined") return () => {};

  const isCrypto = symbol.endsWith("USDT") || symbol === "BTC" || symbol === "ETH";
  const cleanSym = isCrypto ? (symbol.endsWith("USDT") ? symbol : `${symbol}USDT`).toLowerCase() : symbol.toLowerCase();

  const entry = getOrCreateEntry(cleanSym);

  // If a teardown timer is pending from a recent layout switch, cancel it
  if (entry.teardownTimeout) {
    clearTimeout(entry.teardownTimeout);
    entry.teardownTimeout = null;
  }

  entry.listeners.add(onTrade);
  if (onStatusChange) {
    entry.statusListeners.add(onStatusChange);
    onStatusChange(entry.status);
  }

  // Connect if not already connected/connecting
  if (!entry.ws || entry.ws.readyState === WebSocket.CLOSED) {
    connectStream(cleanSym);
  }

  return () => {
    entry.listeners.delete(onTrade);
    if (onStatusChange) entry.statusListeners.delete(onStatusChange);

    // If zero listeners remain, debounce teardown by 3000ms to preserve connection across layout/column changes
    if (entry.listeners.size === 0) {
      if (entry.teardownTimeout) clearTimeout(entry.teardownTimeout);
      entry.teardownTimeout = setTimeout(() => {
        if (entry.listeners.size === 0) {
          if (entry.reconnectTimeout) clearTimeout(entry.reconnectTimeout);
          if (entry.watchdogInterval) clearInterval(entry.watchdogInterval);
          safeClose(entry.ws);
          entry.ws = null;
          streams.delete(cleanSym);
        }
      }, 3000);
    }
  };
}

