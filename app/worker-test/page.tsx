"use client";

import { useEffect, useState } from "react";

// Task 1.0 - Web Worker bundling verification page.
// Temporary: delete this route once 1.0.1-1.0.5 are confirmed passing and
// the real OrderBookPanel (1.3) exists. Not part of the shipped terminal UI.

export default function WorkerTestPage() {
  const [status, setStatus] = useState<"idle" | "waiting" | "ok" | "error">(
    "idle"
  );
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    // Instantiating the Worker INSIDE useEffect is required (task 1.3.1):
    // Next.js renders this component server-side first, and `Worker` is a
    // browser-only global. useEffect only runs client-side after mount, so
    // this line never executes during SSR.
    setStatus("waiting");

    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../../workers/echo-test.worker.ts", import.meta.url)
      );
    } catch (err) {
      setStatus("error");
      setLog((l) => [...l, `Failed to construct Worker: ${String(err)}`]);
      return;
    }

    worker.onmessage = (event: MessageEvent) => {
      setStatus("ok");
      setLog((l) => [...l, `Received: ${JSON.stringify(event.data)}`]);
    };

    worker.onerror = (event: ErrorEvent) => {
      setStatus("error");
      setLog((l) => [...l, `Worker error: ${event.message}`]);
    };

    worker.postMessage({ ping: "hello from main thread", sentAt: Date.now() });

    return () => worker.terminate();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Worker bundling verification (task 1.0)</h1>
      <p>
        Status: <strong>{status}</strong>
      </p>
      <p style={{ color: "#6b7280", maxWidth: 640 }}>
        Checklist: run this page under <code>npm run dev</code> AND under{" "}
        <code>npm run build &amp;&amp; npm start</code> (task 1.0.3) - dev and
        prod bundling can behave differently, don&apos;t assume one working
        means both do. &quot;ok&quot; means the Worker constructed, received
        the message, ran independently, and posted back.
      </p>
      <ul>
        {log.map((entry, i) => (
          <li key={i} style={{ fontFamily: "monospace" }}>
            {entry}
          </li>
        ))}
      </ul>
    </main>
  );
}
