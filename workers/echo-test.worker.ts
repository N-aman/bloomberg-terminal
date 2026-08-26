/// <reference lib="webworker" />

// Task 1.0.2 - trivial placeholder Worker.
// Purpose: confirm Next.js (dev AND prod build) can bundle and run a Worker
// via `new Worker(new URL('./echo-test.worker.ts', import.meta.url))` before
// any real reconciliation logic (1.1) goes anywhere near a Worker context.
//
// The `/// <reference lib="webworker" />` directive above gives this file
// WebWorker-scoped types (self, postMessage, onmessage) without conflicting
// with the DOM-scoped lib types used by the rest of the app (task 1.0.4) -
// mixing "dom" and "webworker" in one shared tsconfig lib array causes type
// conflicts (both declare incompatible versions of `self`), so this file
// gets its own scoped reference instead of a tsconfig change.

self.onmessage = (event: MessageEvent) => {
  // Echo back whatever was sent, tagged with a timestamp, so the caller
  // can confirm a real round-trip happened (not just that postMessage
  // didn't throw).
  self.postMessage({
    echoed: event.data,
    workerTimestamp: Date.now(),
  });
};
