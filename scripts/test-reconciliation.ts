// Run: npx tsx scripts/test-reconciliation.ts [--chaos]
export {};

const SYMBOL = "BTCUSDT";
const SNAPSHOT_URL = `https://api.binance.com/api/v3/depth?symbol=${SYMBOL}&limit=1000`;
const WS_URL = `wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@depth`;

const CHAOS_MODE = process.argv.includes("--chaos");
const CHAOS_DROP_RATE = 0.05;

type DepthEvent = { U: number; u: number; b: [string, string][]; a: [string, string][] };
type Snapshot = { lastUpdateId: number; bids: [string, string][]; asks: [string, string][] };

class OrderBook {
  bids = new Map<number, number>();
  asks = new Map<number, number>();
  lastUpdateId = 0;

  loadSnapshot(s: Snapshot) {
    this.bids = new Map(s.bids.map(([p, q]) => [Number(p), Number(q)]));
    this.asks = new Map(s.asks.map(([p, q]) => [Number(p), Number(q)]));
    this.lastUpdateId = s.lastUpdateId;
  }

  applyDelta(e: DepthEvent) {
    for (const [p, q] of e.b) this.setLevel(this.bids, Number(p), Number(q));
    for (const [p, q] of e.a) this.setLevel(this.asks, Number(p), Number(q));
    this.lastUpdateId = e.u;
  }

  private setLevel(side: Map<number, number>, price: number, qty: number) {
    qty === 0 ? side.delete(price) : side.set(price, qty); // replace, not increment (1.1.7)
  }

  bestBid() { return this.bids.size ? Math.max(...this.bids.keys()) : null; }
  bestAsk() { return this.asks.size ? Math.min(...this.asks.keys()) : null; }
}

async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch(SNAPSHOT_URL);
  if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`);
  return res.json();
}

let lastResyncAttempt = 0;
const RESYNC_COOLDOWN_MS = 2500; // resync-specific backoff, task 1.2.5

async function main() {
  console.log(`Reconciliation test: ${SYMBOL}${CHAOS_MODE ? " [CHAOS ON]" : ""}`);
  const book = new OrderBook();
  let buffer: DepthEvent[] = [];
  let synced = false;

  const ws = new WebSocket(WS_URL);
  ws.onopen = () => console.log("WS connected, buffering...");

  ws.onmessage = (msg) => {
    const event: DepthEvent = JSON.parse(msg.data as string);
    if (CHAOS_MODE && Math.random() < CHAOS_DROP_RATE) {
      console.log(`[chaos] dropped U=${event.U} u=${event.u}`);
      return;
    }
    synced ? handleEvent(event) : buffer.push(event);
  };

  ws.onclose = () => console.log("WS closed.");
  ws.onerror = (e) => console.error("WS error:", e);

  function handleEvent(event: DepthEvent) {
    const nextUpdateId = book.lastUpdateId + 1;
    if (event.u < nextUpdateId) return; // stale or duplicate event
    if (event.U > nextUpdateId) {                    // contiguity check, 1.1.5
      console.warn(`Gap! expected U=${book.lastUpdateId + 1}, got ${event.U}`);
      return triggerResync();
    }
    book.applyDelta(event);
  }

  async function triggerResync() {
    if (Date.now() - lastResyncAttempt < RESYNC_COOLDOWN_MS) {
      console.log("Resync on cooldown, skipping");
      return;
    }
    lastResyncAttempt = Date.now();
    synced = false;
    buffer = [];
    console.log("Resyncing...");
    await syncFromSnapshot();
  }

  async function syncFromSnapshot() {
    const snapshot = await fetchSnapshot();
    book.loadSnapshot(snapshot);
    buffer = buffer.filter((e) => e.u > snapshot.lastUpdateId); // discard-stale, 1.1.3

    const first = buffer[0];
    if (first && !(first.U <= snapshot.lastUpdateId + 1 && first.u >= snapshot.lastUpdateId + 1)) {
      console.warn("First event doesn't overlap snapshot - resyncing again"); // 1.1.4
      buffer = [];
      return triggerResync();
    }

    if (first) {
      book.applyDelta(first);
      buffer.slice(1).forEach(handleEvent);
    }
    buffer = [];
    synced = true;
    console.log(`Synced. lastUpdateId=${book.lastUpdateId} bid=${book.bestBid()} ask=${book.bestAsk()}`);
  }

  setTimeout(syncFromSnapshot, 2000); // buffer briefly before first snapshot pull

  setInterval(() => {
    console.log(`[status] lastUpdateId=${book.lastUpdateId} bid=${book.bestBid()} ask=${book.bestAsk()} buffered=${buffer.length}`);
  }, 5000);
}

main().catch(console.error);