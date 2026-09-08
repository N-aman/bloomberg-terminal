/**
 * Pure reconciliation algorithm for the Binance order book.
 *
 * No browser APIs, no Worker globals, no fetch — just Maps and plain
 * functions so this module can be imported by both the Worker and
 * test files running in Node.
 *
 * Implements the procedure documented in Section 6 of the README:
 *  1. Buffer incoming stream events before snapshot.
 *  2. Fetch REST snapshot.
 *  3. Discard stale buffered events (u <= lastUpdateId).
 *  4. Validate first-event U/u overlap — the critical correctness check.
 *  5. Apply remaining buffered events, validating contiguity.
 *  6. On gap → return 'gap'; caller is responsible for re-fetching a snapshot.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DepthEvent = {
  /** First update ID in event */
  U: number;
  /** Final update ID in event */
  u: number;
  /** Bid changes: [price, quantity] string tuples */
  b: [string, string][];
  /** Ask changes: [price, quantity] string tuples */
  a: [string, string][];
};

export type Snapshot = {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
};

export type BookState = {
  bids: Map<number, number>;
  asks: Map<number, number>;
  lastUpdateId: number;
};

/** Return value of handleEvent */
export type EventResult =
  | "applied"   // delta applied successfully, book updated
  | "stale"     // event is older than current state, silently ignored
  | "gap";      // sequence gap detected — caller must resync

/** Return value of applyBufferedEvents */
export type SyncResult =
  | "ok"    // snapshot applied, all buffered events processed
  | "gap";  // first-event U/u overlap check failed — caller must resync again

// ---------------------------------------------------------------------------
// Core state helpers
// ---------------------------------------------------------------------------

export function newBookState(): BookState {
  return { bids: new Map(), asks: new Map(), lastUpdateId: 0 };
}

/**
 * Load a REST snapshot into existing state (task 1.1.1).
 * Replaces both Maps entirely — this is always a full replace, never a merge.
 */
export function loadSnapshot(state: BookState, snapshot: Snapshot): void {
  state.bids = new Map(snapshot.bids.map(([p, q]) => [Number(p), Number(q)]));
  state.asks = new Map(snapshot.asks.map(([p, q]) => [Number(p), Number(q)]));
  state.lastUpdateId = snapshot.lastUpdateId;
}

/**
 * Apply a single depth event to state (task 1.1.7).
 *
 * Binance delta semantics: each [price, quantity] pair **replaces** the
 * quantity at that price level — it does NOT increment. quantity === 0
 * means "remove this price level entirely."
 */
export function applyDelta(state: BookState, event: DepthEvent): void {
  for (const [p, q] of event.b) setLevel(state.bids, Number(p), Number(q));
  for (const [p, q] of event.a) setLevel(state.asks, Number(p), Number(q));
  state.lastUpdateId = event.u;
}

function setLevel(side: Map<number, number>, price: number, qty: number): void {
  qty === 0 ? side.delete(price) : side.set(price, qty);
}

// ---------------------------------------------------------------------------
// Event handling (steady-state, post-sync)
// ---------------------------------------------------------------------------

/**
 * Handle a single incoming stream event against the current synced book
 * (tasks 1.1.3, 1.1.5, 1.1.7).
 *
 * Rules:
 *  - event.u <= state.lastUpdateId  → stale/duplicate, ignore silently
 *  - event.U > state.lastUpdateId+1 → sequence gap, caller must resync
 *  - otherwise                      → apply delta
 */
export function handleEvent(state: BookState, event: DepthEvent): EventResult {
  const next = state.lastUpdateId + 1;
  if (event.u < next) return "stale";   // task 1.1.3 — stale or duplicate
  if (event.U > next) return "gap";     // task 1.1.5 — gap detected
  applyDelta(state, event);
  return "applied";
}

// ---------------------------------------------------------------------------
// Buffer processing (runs once after snapshot fetch)
// ---------------------------------------------------------------------------

/**
 * After fetching a snapshot, apply the buffered events collected during the
 * snapshot fetch window (tasks 1.1.3, 1.1.4, 1.1.5).
 *
 * Steps:
 *  1. Discard stale events (u <= snapshot.lastUpdateId).
 *  2. Check the first remaining event's U/u overlap condition (task 1.1.4).
 *     This is the single most important correctness check: confirms the first
 *     buffered event actually spans the snapshot's lastUpdateId, preventing
 *     silent book corruption when a partial update landed between snapshot
 *     fetch and stream buffering.
 *  3. Apply first event unconditionally (already validated by overlap check).
 *  4. Apply remaining events via handleEvent (validates contiguity).
 *
 * Returns 'gap' if the overlap check fails — caller should re-fetch a fresh
 * snapshot and call this again with a new buffer.
 *
 * NOTE: this function does NOT mutate `buffer`. The caller owns the buffer
 * and should clear it after this call regardless of the return value.
 */
export function applyBufferedEvents(
  state: BookState,
  buffer: DepthEvent[]
): SyncResult {
  // Step 1: discard events older than the snapshot (task 1.1.3).
  const fresh = buffer.filter((e) => e.u > state.lastUpdateId);

  if (fresh.length === 0) {
    // No buffered events to process — book is consistent with snapshot.
    return "ok";
  }

  const first = fresh[0];

  // Step 2: first-event U/u overlap check (task 1.1.4 — THE critical check).
  //
  // The first event must satisfy BOTH conditions:
  //   - first.U <= lastUpdateId + 1  (event starts at or before the next expected ID)
  //   - first.u >= lastUpdateId + 1  (event ends at or after the next expected ID)
  //
  // This guarantees the event spans the snapshot's lastUpdateId, meaning
  // there is no gap between the snapshot and the first buffered event.
  // Checking only "is the next ID contiguous" misses the case where a
  // partial update landed between snapshot and buffer — checking U/u covers it.
  const nextId = state.lastUpdateId + 1;
  if (!(first.U <= nextId && first.u >= nextId)) {
    return "gap";
  }

  // Step 3: apply the first event (its overlap is already validated above).
  applyDelta(state, first);

  // Step 4: apply the rest via handleEvent for contiguity validation.
  for (const event of fresh.slice(1)) {
    const result = handleEvent(state, event);
    if (result === "gap") return "gap";
    // "stale" here would be unusual but safe to ignore — handleEvent handles it.
  }

  return "ok";
}

// ---------------------------------------------------------------------------
// Convenience: best bid/ask
// ---------------------------------------------------------------------------

export function bestBid(state: BookState): number | null {
  return state.bids.size ? Math.max(...state.bids.keys()) : null;
}

export function bestAsk(state: BookState): number | null {
  return state.asks.size ? Math.min(...state.asks.keys()) : null;
}

