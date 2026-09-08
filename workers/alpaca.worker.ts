/// <reference lib="webworker" />

/**
 * Alpaca Market Data WebSocket Worker (IEX Feed)
 * Architecture: Web Worker dedicated to Alpaca streaming data.
 * Features:
 *  - 6-state connection & authentication handshake machine
 *  - 30-symbol active subscription cap enforcement
 *  - Quote (q), Trade (t), and Bar (b) stream dispatching
 *  - 16ms delta batching to main thread
 *  - Exponential reconnect backoff
 */

const ALPACA_WS_URL = "wss://stream.data.alpaca.markets/v2/iex";
const MAX_SYMBOLS_CAP = 30;

export type AlpacaQuoteMessage = {
  T: "q";
  S: string; // symbol
  bx: string; // bid exchange
  bp: number; // bid price
  bs: number; // bid size
  ax: string; // ask exchange
  ap: number; // ask price
  as: number; // ask size
  c: string[]; // condition flags
  t: string; // timestamp
};

export type AlpacaTradeMessage = {
  T: "t";
  S: string; // symbol
  i: number; // trade ID
  x: string; // exchange
  p: number; // price
  s: number; // size
  t: string; // timestamp
  c: string[]; // conditions
  z: string; // tape
};

export type AlpacaBarMessage = {
  T: "b";
  S: string; // symbol
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  t: string; // timestamp
  n: number; // trade count
  vw: number; // vwap
};

type ConnectionState = "disconnected" | "connecting" | "connected" | "authenticating" | "authenticated" | "subscribing" | "live";

let ws: WebSocket | null = null;
let state: ConnectionState = "disconnected";
let credentials: { apiKey: string; apiSecret: string } | null = null;

const subscribedSymbols = new Set<string>();
const pendingQuotes = new Map<string, AlpacaQuoteMessage>();
const pendingTrades: AlpacaTradeMessage[] = [];
const pendingBars = new Map<string, AlpacaBarMessage>();

const reconnectBackoff = { attempts: 0, lastAttempt: 0 };
const BASE_DELAY = 1500;
const MAX_DELAY = 30000;

function backoffDelay(track: { attempts: number }) {
  return Math.min(BASE_DELAY * 2 ** track.attempts, MAX_DELAY);
}

// ── 16ms Flush Batcher to Main Thread (~60 FPS) ────────────────────
setInterval(() => {
  if (pendingQuotes.size === 0 && pendingTrades.length === 0 && pendingBars.size === 0) return;

  self.postMessage({
    type: "alpaca_batch",
    quotes: Array.from(pendingQuotes.values()),
    trades: [...pendingTrades],
    bars: Array.from(pendingBars.values()),
    timestamp: Date.now(),
  });

  pendingQuotes.clear();
  pendingTrades.length = 0;
  pendingBars.clear();
}, 16);

function setState(newState: ConnectionState) {
  state = newState;
  self.postMessage({ type: "alpaca_status", status: state });
}

function connect() {
  if (!credentials || !credentials.apiKey || !credentials.apiSecret) {
    self.postMessage({ type: "alpaca_error", message: "Alpaca credentials missing. Cannot connect WS." });
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  setState("connecting");
  ws = new WebSocket(ALPACA_WS_URL);

  ws.onopen = () => {
    reconnectBackoff.attempts = 0;
    // Wait for the connected message before authenticating
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const messages = JSON.parse(event.data as string);
      if (!Array.isArray(messages)) return;

      for (const msg of messages) {
        handleServerMessage(msg);
      }
    } catch (err) {
      console.error("[Alpaca Worker] Error parsing message:", err);
    }
  };

  ws.onclose = () => {
    setState("disconnected");
    if (subscribedSymbols.size > 0) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function handleServerMessage(msg: any) {
  const msgType = msg.T;

  if (msgType === "success") {
    if (msg.msg === "connected") {
      setState("connected");
      // Step 2: Authenticate
      authenticate();
    } else if (msg.msg === "authenticated") {
      setState("authenticated");
      // Step 3: Resubscribe active symbol set
      if (subscribedSymbols.size > 0) {
        sendSubscription(Array.from(subscribedSymbols));
      } else {
        setState("live");
      }
    }
  } else if (msgType === "subscription") {
    setState("live");
    self.postMessage({
      type: "alpaca_subscribed",
      quotes: msg.quotes || [],
      trades: msg.trades || [],
      bars: msg.bars || [],
    });
  } else if (msgType === "error") {
    self.postMessage({ type: "alpaca_error", code: msg.code, message: msg.msg });
  } else if (msgType === "q") {
    // Top of book quote update
    pendingQuotes.set(msg.S, msg as AlpacaQuoteMessage);
  } else if (msgType === "t") {
    // Trade print
    pendingTrades.push(msg as AlpacaTradeMessage);
    if (pendingTrades.length > 200) pendingTrades.shift();
  } else if (msgType === "b") {
    // 1-minute OHLCV bar
    pendingBars.set(msg.S, msg as AlpacaBarMessage);
  }
}

function authenticate() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !credentials) return;
  setState("authenticating");
  ws.send(
    JSON.stringify({
      action: "auth",
      key: credentials.apiKey,
      secret: credentials.apiSecret,
    })
  );
}

function sendSubscription(symbolsList: string[]) {
  if (!ws || ws.readyState !== WebSocket.OPEN || state !== "authenticated") return;
  setState("subscribing");
  ws.send(
    JSON.stringify({
      action: "subscribe",
      quotes: symbolsList,
      trades: symbolsList,
      bars: symbolsList,
    })
  );
}

function sendUnsubscription(symbolsList: string[]) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      action: "unsubscribe",
      quotes: symbolsList,
      trades: symbolsList,
      bars: symbolsList,
    })
  );
}

function scheduleReconnect() {
  reconnectBackoff.attempts++;
  reconnectBackoff.lastAttempt = Date.now();
  const delay = backoffDelay(reconnectBackoff);
  setTimeout(connect, delay);
}

function subscribe(symbol: string) {
  const sym = symbol.trim().toUpperCase();
  if (subscribedSymbols.has(sym)) return;

  // Enforce strict 30-symbol cap
  if (subscribedSymbols.size >= MAX_SYMBOLS_CAP) {
    // Evict oldest symbol
    const oldest = subscribedSymbols.values().next().value;
    if (oldest) {
      subscribedSymbols.delete(oldest);
      sendUnsubscription([oldest]);
    }
  }

  subscribedSymbols.add(sym);

  if (state === "authenticated" || state === "live") {
    sendSubscription([sym]);
  } else if (state === "disconnected") {
    connect();
  }
}

function unsubscribe(symbol: string) {
  const sym = symbol.trim().toUpperCase();
  if (!subscribedSymbols.has(sym)) return;

  subscribedSymbols.delete(sym);
  pendingQuotes.delete(sym);
  pendingBars.delete(sym);

  if (state === "live" || state === "authenticated") {
    sendUnsubscription([sym]);
  }
}

self.onmessage = (event: MessageEvent) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === "config") {
    credentials = {
      apiKey: msg.apiKey,
      apiSecret: msg.apiSecret,
    };
    if (subscribedSymbols.size > 0 && state === "disconnected") {
      connect();
    }
  } else if (msg.type === "subscribe") {
    subscribe(msg.symbol);
  } else if (msg.type === "unsubscribe") {
    unsubscribe(msg.symbol);
  } else if (msg.type === "disconnect") {
    subscribedSymbols.clear();
    ws?.close();
    ws = null;
    setState("disconnected");
  }
};

