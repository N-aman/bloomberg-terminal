/**
 * Formal reconciliation tests (README §12, tasks 1.1.8 / 1.6.3)
 *
 * These tests exercise every branch of lib/reconciliation.ts with
 * deterministic inputs — no network, no WebSocket, no timers. Each test
 * corresponds to a specific correctness requirement from Section 6 of the
 * README and is labelled with the task number it covers.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  newBookState,
  loadSnapshot,
  applyDelta,
  handleEvent,
  applyBufferedEvents,
  bestBid,
  bestAsk,
  type BookState,
  type DepthEvent,
  type Snapshot,
} from "../lib/reconciliation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a DepthEvent with sensible defaults. */
function event(
  U: number,
  u: number,
  bids: [string, string][] = [],
  asks: [string, string][] = []
): DepthEvent {
  return { U, u, b: bids, a: asks };
}

/** Build a Snapshot. */
function snapshot(
  lastUpdateId: number,
  bids: [string, string][] = [],
  asks: [string, string][] = []
): Snapshot {
  return { lastUpdateId, bids, asks };
}

// ---------------------------------------------------------------------------
// loadSnapshot
// ---------------------------------------------------------------------------

describe("loadSnapshot", () => {
  it("populates bids and asks from the snapshot and sets lastUpdateId", () => {
    const state = newBookState();
    loadSnapshot(
      state,
      snapshot(100, [["50000", "1.5"], ["49900", "2.0"]], [["50100", "0.8"]])
    );

    expect(state.lastUpdateId).toBe(100);
    expect(state.bids.get(50000)).toBe(1.5);
    expect(state.bids.get(49900)).toBe(2.0);
    expect(state.asks.get(50100)).toBe(0.8);
  });

  it("completely replaces existing book state — does not merge", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(50, [["40000", "3.0"]], []));
    // Load a different snapshot on top.
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    expect(state.bids.has(40000)).toBe(false); // old level gone
    expect(state.bids.get(50000)).toBe(1.0);   // new level present
    expect(state.lastUpdateId).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// applyDelta — replace semantics (task 1.1.7)
// ---------------------------------------------------------------------------

describe("applyDelta — replace semantics (task 1.1.7)", () => {
  let state: BookState;

  beforeEach(() => {
    state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], [["50100", "0.5"]]));
  });

  it("replaces the quantity at a price level (not increments)", () => {
    applyDelta(state, event(101, 101, [["50000", "3.0"]], []));
    expect(state.bids.get(50000)).toBe(3.0); // replaced, not 1.0 + 3.0
  });

  it("quantity === 0 removes the price level entirely (task 1.1.7)", () => {
    applyDelta(state, event(101, 101, [["50000", "0"]], []));
    expect(state.bids.has(50000)).toBe(false);
  });

  it("advances lastUpdateId to event.u", () => {
    applyDelta(state, event(101, 105, [], []));
    expect(state.lastUpdateId).toBe(105);
  });

  it("applies ask-side updates independently of bid-side", () => {
    applyDelta(state, event(101, 101, [], [["50100", "2.5"]]));
    expect(state.asks.get(50100)).toBe(2.5);
    expect(state.bids.get(50000)).toBe(1.0); // bid unchanged
  });

  it("adds a new price level that did not exist in the snapshot", () => {
    applyDelta(state, event(101, 101, [["49800", "5.0"]], []));
    expect(state.bids.get(49800)).toBe(5.0);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — stale and duplicate events (task 1.1.3)
// ---------------------------------------------------------------------------

describe("handleEvent — stale/duplicate events (task 1.1.3)", () => {
  let state: BookState;

  beforeEach(() => {
    state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));
  });

  it("returns 'stale' and does not modify book when event.u < lastUpdateId + 1", () => {
    const result = handleEvent(state, event(90, 99, [["50000", "99.0"]], []));
    expect(result).toBe("stale");
    expect(state.bids.get(50000)).toBe(1.0); // unchanged
    expect(state.lastUpdateId).toBe(100);    // unchanged
  });

  it("returns 'stale' and ignores event when event.u === lastUpdateId (exact duplicate)", () => {
    const result = handleEvent(state, event(100, 100, [["50000", "99.0"]], []));
    expect(result).toBe("stale");
    expect(state.bids.get(50000)).toBe(1.0);
  });

  it("returns 'applied' for the exact next event in sequence", () => {
    const result = handleEvent(state, event(101, 101, [["50000", "2.0"]], []));
    expect(result).toBe("applied");
    expect(state.bids.get(50000)).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// handleEvent — gap detection (task 1.1.5)
// ---------------------------------------------------------------------------

describe("handleEvent — gap detection (task 1.1.5)", () => {
  let state: BookState;

  beforeEach(() => {
    state = newBookState();
    loadSnapshot(state, snapshot(100, [], []));
  });

  it("returns 'gap' when event.U > lastUpdateId + 1 (missed update)", () => {
    // lastUpdateId = 100, so next expected U = 101.
    // Sending U=103 means updates 101 and 102 were missed.
    const result = handleEvent(state, event(103, 105, [], []));
    expect(result).toBe("gap");
  });

  it("does not modify the book state when a gap is detected", () => {
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));
    handleEvent(state, event(103, 105, [["50000", "99.0"]], []));
    expect(state.bids.get(50000)).toBe(1.0); // book untouched
    expect(state.lastUpdateId).toBe(100);
  });

  it("does not detect a gap for an event whose U === lastUpdateId + 1", () => {
    const result = handleEvent(state, event(101, 102, [], []));
    expect(result).toBe("applied");
  });
});

// ---------------------------------------------------------------------------
// applyBufferedEvents — stale discard (task 1.1.3)
// ---------------------------------------------------------------------------

describe("applyBufferedEvents — discard stale buffered events (task 1.1.3)", () => {
  it("discards events with u <= snapshot.lastUpdateId before applying", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    const buffer = [
      event(90, 95, [["50000", "999.0"]], []), // stale: u=95 <= 100
      event(95, 100, [["50000", "888.0"]], []), // stale: u=100 <= 100
      event(101, 101, [["50000", "2.0"]], []),  // fresh: u=101 > 100
    ];

    const result = applyBufferedEvents(state, buffer);
    expect(result).toBe("ok");
    expect(state.bids.get(50000)).toBe(2.0);   // only fresh event applied
  });

  it("returns ok with unchanged state when all buffered events are stale", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    const buffer = [event(80, 90, [["50000", "999.0"]], [])];
    const result = applyBufferedEvents(state, buffer);

    expect(result).toBe("ok");
    expect(state.bids.get(50000)).toBe(1.0); // unchanged
  });

  it("returns ok when the buffer is empty", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [], []));
    expect(applyBufferedEvents(state, [])).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// applyBufferedEvents — first-event U/u overlap check (task 1.1.4)
// THE most important correctness check in the whole algorithm.
// ---------------------------------------------------------------------------

describe("applyBufferedEvents — first-event U/u overlap check (task 1.1.4)", () => {
  it("returns 'ok' when first.U <= lastUpdateId+1 AND first.u >= lastUpdateId+1", () => {
    // lastUpdateId = 100, so nextId = 101.
    // Valid: U=100 (<=101) and u=102 (>=101) — spans the boundary.
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [], []));

    const buffer = [event(100, 102, [["50000", "1.0"]], [])];
    expect(applyBufferedEvents(state, buffer)).toBe("ok");
    expect(state.bids.get(50000)).toBe(1.0);
  });

  it("returns 'ok' for exact-boundary event: U === lastUpdateId+1", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [], []));

    const buffer = [event(101, 101, [["50000", "2.0"]], [])];
    expect(applyBufferedEvents(state, buffer)).toBe("ok");
    expect(state.bids.get(50000)).toBe(2.0);
  });

  it("returns 'gap' when first.U > lastUpdateId+1 (gap between snapshot and first buffered event)", () => {
    // lastUpdateId = 100, nextId = 101.
    // U=103 means updates 101 and 102 are missing between snapshot and buffer.
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    const buffer = [event(103, 105, [["50000", "999.0"]], [])];
    const result = applyBufferedEvents(state, buffer);

    expect(result).toBe("gap");
    // Book must NOT be corrupted with the bad event's data.
    expect(state.bids.get(50000)).toBe(1.0);
  });

  it("returns 'gap' when first.u < lastUpdateId+1 (event ends before the snapshot boundary)", () => {
    // lastUpdateId = 100, nextId = 101.
    // U=99, u=100 — this event ends at 100, does not reach 101.
    // This event doesn't survive the stale discard (u=100 <= lastUpdateId=100).
    // So after discard the buffer is empty → "ok". Let's test with a subtler case:
    // lastUpdateId = 100, nextId = 101.
    // U=100, u=100 — stale (u <= lastUpdateId), gets discarded.
    // U=102, u=103 — first fresh event, but U=102 > nextId=101 → gap.
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [], []));

    const buffer = [
      event(100, 100, [], []),  // discarded as stale
      event(102, 103, [], []),  // U=102 > nextId=101 → gap
    ];
    expect(applyBufferedEvents(state, buffer)).toBe("gap");
  });

  it("does not modify book state when the overlap check fails", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    const buffer = [event(103, 105, [["50000", "CORRUPTED"]], [])];
    applyBufferedEvents(state, buffer);

    expect(state.bids.get(50000)).toBe(1.0); // untouched — this is the whole point
  });
});

// ---------------------------------------------------------------------------
// applyBufferedEvents — full normal operation (happy path)
// ---------------------------------------------------------------------------

describe("applyBufferedEvents — normal operation (happy path)", () => {
  it("applies multiple contiguous buffered events in order", () => {
    const state = newBookState();
    loadSnapshot(
      state,
      snapshot(100, [["50000", "1.0"], ["49900", "2.0"]], [["50100", "0.5"]])
    );

    const buffer = [
      event(101, 101, [["50000", "1.5"]], []),          // updates best bid
      event(102, 102, [], [["50100", "0.3"]]),           // updates best ask
      event(103, 103, [["49800", "5.0"]], []),           // new bid level
      event(104, 104, [["49900", "0"]], []),             // removes 49900 level
    ];

    const result = applyBufferedEvents(state, buffer);

    expect(result).toBe("ok");
    expect(state.bids.get(50000)).toBe(1.5);
    expect(state.asks.get(50100)).toBe(0.3);
    expect(state.bids.get(49800)).toBe(5.0);
    expect(state.bids.has(49900)).toBe(false); // removed
    expect(state.lastUpdateId).toBe(104);
  });

  it("detects a gap mid-buffer and returns 'gap'", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    const buffer = [
      event(101, 101, [["50000", "2.0"]], []),  // ok
      event(102, 102, [["50000", "3.0"]], []),  // ok
      event(104, 104, [["50000", "4.0"]], []),  // gap! U=104, expected U=103
    ];

    const result = applyBufferedEvents(state, buffer);
    expect(result).toBe("gap");
    // The first two events were already applied before the gap was detected.
    // State is partially applied — caller should treat this as a full resync trigger.
  });
});

// ---------------------------------------------------------------------------
// bestBid / bestAsk convenience helpers
// ---------------------------------------------------------------------------

describe("bestBid / bestAsk", () => {
  it("returns null when book is empty", () => {
    const state = newBookState();
    expect(bestBid(state)).toBeNull();
    expect(bestAsk(state)).toBeNull();
  });

  it("returns the highest bid price", () => {
    const state = newBookState();
    loadSnapshot(
      state,
      snapshot(1, [["49800", "1"], ["50000", "1"], ["49900", "1"]], [])
    );
    expect(bestBid(state)).toBe(50000);
  });

  it("returns the lowest ask price", () => {
    const state = newBookState();
    loadSnapshot(
      state,
      snapshot(1, [], [["50100", "1"], ["50300", "1"], ["50200", "1"]])
    );
    expect(bestAsk(state)).toBe(50100);
  });

  it("spread is positive (bestAsk > bestBid) after a realistic snapshot", () => {
    const state = newBookState();
    loadSnapshot(
      state,
      snapshot(1, [["50000", "1"]], [["50010", "1"]])
    );
    const bid = bestBid(state)!;
    const ask = bestAsk(state)!;
    expect(ask - bid).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Sequence of handleEvent calls — simulates steady-state stream processing
// ---------------------------------------------------------------------------

describe("steady-state stream processing via handleEvent", () => {
  it("processes a long sequence of contiguous events without drift", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(1000, [["50000", "1.0"]], [["50100", "1.0"]]));

    // Feed 50 sequential events, each updating a price level.
    for (let i = 1; i <= 50; i++) {
      const result = handleEvent(
        state,
        event(1000 + i, 1000 + i, [["50000", String(i)]], [])
      );
      expect(result).toBe("applied");
    }

    expect(state.lastUpdateId).toBe(1050);
    expect(state.bids.get(50000)).toBe(50); // last event's qty wins
  });

  it("silently ignores duplicate events mid-stream without corrupting state", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(100, [["50000", "1.0"]], []));

    handleEvent(state, event(101, 101, [["50000", "2.0"]], [])); // applied
    const dupe = handleEvent(state, event(101, 101, [["50000", "99.0"]], [])); // duplicate

    expect(dupe).toBe("stale");
    expect(state.bids.get(50000)).toBe(2.0); // not overwritten by duplicate
    expect(state.lastUpdateId).toBe(101);
  });

  it("detects a single dropped event in a long sequence", () => {
    const state = newBookState();
    loadSnapshot(state, snapshot(200, [], []));

    // Apply events 201–210 successfully.
    for (let i = 201; i <= 210; i++) {
      handleEvent(state, event(i, i, [], []));
    }

    // Skip 211 entirely — next event is 212.
    const result = handleEvent(state, event(212, 212, [], []));
    expect(result).toBe("gap");
    expect(state.lastUpdateId).toBe(210); // state frozen at last good update
  });
});

