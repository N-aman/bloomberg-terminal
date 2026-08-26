# Personal Bloomberg Terminal — Project Plan

## 1. What This Project Actually Is

A browser-based, dark-themed, command-driven financial dashboard inspired by the Bloomberg Terminal's **interface paradigm** — not an attempt to replicate Bloomberg's data. Built entirely on public/free APIs.

**Important framing for interviews:** Bloomberg's real moat is proprietary data (OTC bond pricing, alt-data, analyst consensus, a closed messaging network) — none of which has a public equivalent. This project recreates the *command-line + dense-panel UX paradigm* and a narrow, honest slice of public data (macro, news, crypto order book). Do not overclaim data parity with real Bloomberg in a pitch — it signals a misunderstanding of what was actually built.

## 2. Primary Goal

**Resume/interview signal, not daily-driver usage by friends.** Friend usage is a nice-to-have side effect, not the success metric. Every scope decision should be filtered through: *"does this give me something real to say in an interview?"*

**Context:** current resume isn't getting shortlisted. This project is one lever to pull — but it's worth treating a resume/application review as a separate, parallel track, since project depth is only one of several common causes of shortlisting failure (ATS/keyword mismatch, unclear bullet points/impact, targeting/volume of applications, overall experience signal). Don't rely on this project alone to fix that problem.

## 3. Honest Assessment of the Project's Ceiling

- The **news/macro dashboard (V1)** is a legitimate, clean, mid-tier full-stack portfolio project. The core pattern (fetch → cache → normalize → display) is common and not inherently impressive — execution and articulated tradeoffs are what carry it, not the concept.
- The **real-time order book streaming subsystem** is what pushes this into a genuinely stronger signal — but *only* if built for real, with real update volume, not bolted on cosmetically.
- Decision made: pursue the streaming subsystem deliberately, as the hardest and most load-bearing piece, built first — accepting the added timeline and demo-risk this brings.
- Rejected as fake-depth: a `performance.memory`-based "memory visualizer" panel. `performance.memory` is non-standard, Chrome-only, and JS garbage collection timing cannot be reliably observed or proven on demand — claiming to "prove" GC behavior with it risks demonstrating a misunderstanding of the JS memory model rather than mastery of it. **Do not build this.**

## 4. What Will Make This Stand Out (the real talking points)

1. **Order book reconciliation logic** (the actual hardest problem, bigger signal than Worker/Canvas themselves) — maintaining a correct local order book from an unreliable, gap-prone incremental stream: buffer → snapshot → discard-stale → validate-sequence-contiguity → apply-deltas → detect-gap → resync. This is a real distributed-systems-adjacent state-reconciliation problem.
2. **Web Worker offload** — justified specifically because order book updates are high-frequency; parsing/reconciliation happens off the main thread, only computed deltas are posted to the UI thread.
3. **Canvas-based depth-bar rendering** — justified because React re-rendering the DOM per tick under high update frequency is genuinely costly; canvas + a `requestAnimationFrame` render loop decoupled from message arrival is the correct fix for a real (not hypothetical) performance problem.
4. **Multi-provider data layer with adapters** (V1 news/macro side) — normalizing FRED/Finnhub/NewsAPI into one internal schema.
5. **Shared server-side caching via Upstash Redis** — chosen specifically *because* Vercel serverless functions are stateless, so in-memory caching would silently fail in production. This is a "understood the deployment model" talking point, not just "knows what caching is."
6. **Graceful degradation** — on provider failure, serve last-cached data past TTL with a "may be delayed" indicator, rather than a broken panel. Demoable live by killing an API key in front of an interviewer.
7. **FRED full-catalog search** — real full-text search over 800k+ series, not a static dropdown of presets.

**Explicitly rejected as fake-depth or unjustified by actual load:** memory visualizer panel; Web Worker/Canvas applied to the low-frequency news/macro polling data (no justification — REST polling every 60–120s never produces main-thread pressure).

## 5. Build Sequencing

**Phase 1 (current focus): Streaming order book subsystem**
Built first, deliberately, as the hardest and highest-signal piece — before wiring up the rest of V1.

**Phase 2: V1 core (news + macro)**
Ship after the streaming subsystem is solid, or in parallel once its design is locked.

**Rationale for this order:** the streaming piece is the highest-risk, highest-reward component — better to derisk it early than discover late that it doesn't work well enough to demo.

## 6. Streaming Order Book Subsystem — Locked Design

### Scope
- **Single symbol to start: BTC/USDT** (not switchable yet). Multi-symbol is a natural, easy-to-articulate future extension once the core (Worker book-state keyed by symbol) is proven — don't build it now, added complexity (multiple connections, concurrent resyncs) doesn't make the core algorithm more impressive, just riskier.
- **Data source:** Binance public WebSocket diff-depth stream + REST snapshot endpoint (no API key friction, genuinely public, genuinely real-time).
- **Visualization:** Canvas depth bars (cumulative quantity fill, bids/asks sorted by price, best price nearest the spread), not a plain table.
- **Resync/stale-data indicator:** built in from day one, not deferred — proves the reconciliation problem is handled for real, not just in the happy path.

### Reconciliation algorithm (the core hard problem)
Binance's documented procedure:
1. Open the WebSocket diff-depth stream and buffer incoming events.
2. Fetch a REST snapshot of the current order book (point-in-time full state).
3. Discard any buffered events older than the snapshot.
4. Apply remaining buffered events in sequence, validating update IDs are contiguous.
5. On a detected gap (missed update) → discard local state, re-fetch a fresh snapshot, resync.
6. Once synced, apply each incoming delta directly: a price level's quantity is **replaced** (not incremented) by each update; a quantity of `0` means "remove this price level."

**Critical edge case — first-event-after-snapshot check:** the very first buffered event applied after the snapshot is not just "next in sequence" — it must satisfy Binance's documented overlap condition: the event's `U` (first update ID in event) must be `≤ lastUpdateId + 1`, AND the event's `u` (final update ID in event) must be `≥ lastUpdateId + 1`. This confirms the event actually spans the snapshot's `lastUpdateId`. Skipping this exact check (and just checking "is the next ID contiguous") can silently corrupt the book if a partial update landed between the snapshot fetch and stream buffering — the corruption won't throw an error, it'll just quietly produce a wrong book. This is the single most important correctness check in the whole reconciliation flow and should be tested explicitly, not assumed to fall out of the general contiguity check.

### Architecture
```
Binance WS (diff depth stream)
        │
        ▼
  Web Worker
   ├─ maintains local order book: Map<price, quantity> for bids and asks
   ├─ runs sync procedure above (buffer/snapshot/discard/validate/apply/resync-on-gap)
   ├─ computes only CHANGED price levels per update
   └─ postMessage() → sends small delta payload to main thread (never the full book)
        │
        ▼
   Main thread
   ├─ applies incoming deltas to a plain in-memory book state (NOT React state — avoid per-tick re-renders)
   ├─ requestAnimationFrame loop reads current state, redraws at most once per frame
   └─ resync/stale badge driven by separate Worker status messages (fine as React state — changes rarely)
        │
        ▼
   Canvas: bid/ask depth bars, best bid/ask, spread
```

**Critical architectural constraint — the WebSocket connection is established directly from the browser (inside the Worker) to Binance, and must never be proxied through a Next.js API route.** Vercel serverless functions do not support long-lived connections — they're request/response, execute-and-terminate (Section 6's `AbortController`/timeout discussion assumes this same model). The Next.js backend (API routes, Section 7) exists exclusively for the REST-based News/Macro data layer; it has no role in the streaming subsystem. This must stay a hard boundary: nothing in Phase 1 should ever route through `/app/api/*`, and nothing in Phase 2's data layer should touch WebSocket state. Keep these two subsystems architecturally separate, not just conceptually separate.

**Key design principles:**
- Worker never sends the full book — only `{side, price, quantity}` deltas, to avoid structured-clone overhead of large objects crossing the thread boundary.
- Rendering is decoupled from message arrival via `requestAnimationFrame` — the stream can emit faster than 60fps allows painting; don't do wasted render work between frames the way naive React state updates would.
- Canvas redraws the full visible book each frame (capped at ~15–20 levels per side) — acceptable at this scale, avoids not-worth-it dirty-rectangle complexity.

**Conditional optimization — typed array transfer (do NOT build by default):** plain `postMessage({side, price, quantity})` delta objects are fine at this project's actual scale (single symbol, ~15–20 visible levels). If profiling during testing shows GC pressure from high-frequency delta object creation, the fix is packing `price`/`quantity` into a `Float64Array` and transferring its underlying `ArrayBuffer` directly (zero-copy transfer via the transferable objects API) instead of structured-cloning plain objects. Build this only if profiling justifies it — same principle as the Worker/Canvas decision itself: justify by measured need, not by "more advanced sounds better." In an interview, framing this as "the optimization I'd reach for if profiling showed GC pressure" is stronger than having built it unprompted.

### Message protocol (Worker → Main thread)
```ts
type OrderBookDelta = {
  side: 'bid' | 'ask';
  price: number;
  quantity: number; // 0 = remove this level
};

type WorkerMessage =
  | { type: 'delta'; updates: OrderBookDelta[]; timestamp: number }
  | { type: 'resync' }        // main thread shows stale/resyncing indicator
  | { type: 'error'; message: string };
```

## 7. V1 Core (News + Macro) — Locked Scope

### Stack
Next.js (App Router), deployed on Vercel, Upstash Redis for shared caching, existing custom domain pointed at the deployment.

### In scope
1. **Command bar** — always-visible input; commands: `NEWS`, `NEWS <query>`, `ECON <search term>`, `HELP`. Simple string-matching parser, hand-built (not a library) — small but legitimate, don't oversell it as a "terminal emulator."
2. **News panel** — headline feed (source, timestamp, snippet); Finnhub as primary provider, **Currents API** as secondary/fallback (swapped from NewsAPI — see Section 13 for why: NewsAPI's free tier explicitly blocks production/commercial deployment, which conflicts with the decision in Section 3/7 to deploy live on a custom domain). **Caching note:** even with a more generous free tier, apply the same discipline as originally planned for the tightest-quota provider — check each provider's actual daily cap (Section 13) and set TTL accordingly (aggressive TTL or daily-bucketed keys) rather than assuming a uniform 5-minute TTL is safe across all providers.
3. **Macro panel** — FRED `series/search` full-catalog search (not a static dropdown), line chart + metadata (units, frequency, last updated) on selection, sane pinned defaults shown on load (GDP, CPI, Unemployment, Fed Funds) so the panel isn't empty pre-search.
4. **Data layer** (the core V1 showcase piece):
   - One adapter per provider (FRED, Finnhub, NewsAPI) normalizing responses into a common internal schema
   - Shared, server-side, TTL-based cache via Upstash Redis (shared across all visitors, not per-user — necessary once deployed publicly to avoid multiplying rate-limited API calls per visitor)
   - Rate-limit-aware request handling per provider
   - Graceful degradation: serve last-cached data past TTL on provider failure, with a "data may be delayed" badge
5. **Deployment** — API keys server-side only (Next.js route handlers), never exposed client-side; existing domain pointed at Vercel deployment.

### Explicitly out of scope for V1
- Dockable/draggable panel layout (fixed grid is fine)
- Command-bar autocomplete
- Persisted user accounts / saved layouts across sessions
- Sentiment analysis / custom NLP on news
- Equities/forex panels beyond the crypto order book already planned
- Web Workers / Canvas rendering applied to the news/macro panels (no justification — low update frequency)

### Suggested folder structure
```
Next.js app
 ├─ /app/api/news/route.ts       → server route, fetches + caches Finnhub/NewsAPI
 ├─ /app/api/macro/route.ts      → server route, fetches + caches FRED series
 ├─ /app/api/orderbook/...       → streaming subsystem endpoints/config (if any server-side piece needed)
 ├─ lib/providers/
 │   ├─ fred.ts
 │   ├─ finnhub.ts
 │   └─ newsapi.ts
 ├─ lib/cache.ts                  → Upstash-backed cache helper, TTL per query key
 ├─ workers/orderbook.worker.ts   → reconciliation logic (Phase 1)
 └─ components/panels/
     ├─ NewsPanel.tsx
     ├─ MacroPanel.tsx
     └─ OrderBookPanel.tsx
```

## 8. API Keys / Signups Needed
- **FRED** — https://fred.stlouisfed.org/docs/api/api_key.html — instant, free.
- **Finnhub** — https://finnhub.io/register — instant free key, 60 calls/min free tier.
- **Currents API** — no credit card required, ~600-1,000 req/day, commercial use allowed — replaces NewsAPI as secondary news source (see Section 13).
- **Binance** — public WebSocket + REST endpoints for order book data, no key required.
- **Upstash Redis** — free tier, REST-based (fits serverless well), ~10 min setup.

## 9. Visual/Design Direction
- Dark background, monospace/condensed font, restrained color palette (2–3 accent colors max) — evokes the terminal aesthetic without attempting Bloomberg's actual multi-monitor information density, which would look cluttered rather than impressive with only a few data sources behind it.
- Command bar styled distinctly (doesn't need to literally be yellow, but should stand out as the primary input).
- Panels: tight borders, small header bars, minimal padding — data-first layout, not whitespace-heavy consumer UI.

## 10. Key Decisions Log (why, not just what)
- **Upstash Redis over in-memory cache:** Vercel serverless functions are stateless/ephemeral — in-memory caching would be unreliable in production, not just suboptimal. This is a deployment-model understanding talking point.
- **Polling (not WebSockets) for news/macro:** neither data type is latency-sensitive at the second level (news: 60–120s poll is "live enough"; macro series update monthly/quarterly at most) — WebSockets here would be complexity without benefit.
- **WebSocket + Worker + Canvas reserved for the order book only:** these techniques are only justified by genuinely high update frequency, which news/macro polling never produces. Applying them elsewhere would be unjustified complexity — a red flag in interviews, not a strength.
- **Single order book symbol (BTC/USDT) to start:** proving the reconciliation algorithm correctly is the hard problem; multi-symbol adds connection-management complexity without adding algorithmic depth.
- **Fixed panel grid over dockable panels for V1:** dockable/draggable layout is UX polish, not an engineering-depth talking point — deprioritized given the resume-signal goal.
- **AbortController timeouts on all upstream fetches:** Vercel's serverless function execution cap (10s default on Hobby, configurable up to 60s/300s) means a stalled third-party API call risks a hard platform-level 504 instead of a controlled failure. A 5s client-side abort ensures graceful degradation (Section 7) is what the user sees, not an opaque timeout error.
- **`@upstash/ratelimit` alongside the TTL cache:** TTL caching alone doesn't prevent a cache-stampede — if many visitors hit an uncached query simultaneously, each can trigger its own upstream call before the first one populates the cache. Per-IP rate limiting on the API routes closes that gap and protects free-tier quotas from abusive/bot traffic specifically, which TTL caching alone doesn't address.
- **Worker instantiation inside `useEffect`, never at render top-level:** Next.js SSR evaluates components server-side by default, and `Worker` is browser-only — instantiating outside a client-only lifecycle hook throws at build/render time on the server.
- **Reconnect treated as a full resync, not a resume:** a WS reconnect that just reopens the socket without resetting Worker state (buffered deltas, price-level Maps) can silently corrupt the book exactly the way an undetected sequence gap would — the U/u overlap check (Section 6) is worthless if a reconnect can bypass it. Every reconnect runs the full sync procedure from scratch.
- **Explicit devicePixelRatio canvas scaling:** default canvas sizing renders blurry on Retina/HiDPI displays — scaling the internal pixel buffer (not just CSS size) by `devicePixelRatio` and calling `ctx.scale()` before drawing is necessary for a professional-looking result in a live demo.
- **Standalone CLI script for reconciliation logic before Worker/browser integration:** debugging sequence gaps and network-drop behavior is materially faster in a plain `bun`/`tsx` terminal loop than inside a bundled browser Worker — build and verify the algorithm in isolation first, then port into the Worker once proven.
- **Exponential backoff on resync-triggered snapshot fetches, separate from WS reconnect backoff:** under sustained network jitter, naive "resync on every gap" can spam Binance's snapshot REST endpoint and risk IP-level rate limiting, worsening the exact instability it's trying to recover from.
- **Frame-rate clamping in the canvas render loop:** `requestAnimationFrame` tracks the monitor's native refresh rate, not the data's actual update frequency — on high-refresh displays this wastes GPU/CPU cycles repainting data that hasn't meaningfully changed since the last 60fps-equivalent frame.
- **Native `WebSocket` API over RxJS:** at single-symbol scope there's one stream to manage — RxJS's operator/composition benefits aren't needed and add a dependency + learning-curve cost the problem doesn't justify. Revisit if/when multi-symbol support (Section 11) requires composing several concurrent streams.
- **WebSocket connection lives entirely client-side, never proxied through a Next.js API route:** Vercel serverless functions are request/response, not long-lived-connection-capable — this mirrors the reasoning behind the `AbortController` timeout decision above. The streaming subsystem (Phase 1) and the REST data layer (Phase 2) are kept as a hard architectural boundary, not just a conceptual one.

## 11. Open / Future Items (not committed, worth noting in interviews as forward thinking)

Full consolidated list of everything discussed as out-of-scope-for-now across this conversation, so nothing gets lost. None of these are committed or scheduled — see Section 14 for what to do *now* to keep them cheap later.

- **Multi-symbol order book support** (extend Worker's keyed-by-symbol state) — also the point at which RxJS (Section 10) becomes justified for composing multiple concurrent WS streams; not needed at single-symbol scope.
- **Equities/quotes panel** — via Twelve Data (800 req/day free) or by extending the existing Finnhub adapter, which already covers quotes on the same key (Section 13). Extending Finnhub is the cheaper path; only reach for Twelve Data if Finnhub's quote coverage proves insufficient.
- **Company fundamentals panel** — via Financial Modeling Prep (250 req/day free, income statements/balance sheets/ratios, sourced from SEC EDGAR) — the best-fit option specifically for a "look up a company's financials" feature (Section 13).
- **Deeper SEC EDGAR integration** — full-text filings search was part of the original "what's realistically replicable" framing (Section 1) but never made it into locked V1 scope; still available free/no-key whenever it's picked back up.
- **Command-bar autocomplete** — deferred from V1 (Section 4).
- **Persisted user sessions/layouts** — deferred from V1 (Section 4).
- **Dockable/draggable panel layout** — deferred from V1 (Section 4); fixed grid only for now.
- **Sentiment analysis / custom NLP on news** — explicitly excluded from V1 (Section 7). GDELT (Section 13) is the most viable free data source if this is ever pursued, but it's research-grade and requires real data engineering to use well, not a quick integration.
- **Alt-data via Finnhub's existing key** — social sentiment scores and insider transaction (MSPR) data are already exposed by Finnhub at no extra signup cost (Section 13) — worth revisiting since the key is already in use for news, before adding any new provider.
- **Non-US macro coverage** — World Bank, ECB Statistical Data Warehouse, or IMF Data API (Section 13), all free/no-key, if scope ever expands beyond US-only macro data.
- **Hybrid Canvas+DOM text overlay for the order book** — render depth bars in Canvas, overlay a positioned transparent HTML/CSS grid for price/quantity text, enabling native subpixel text crispness, accessibility, and CSS hover states (e.g. exact order size on hover). Not required for V1 — plain `ctx.fillText` with correct `devicePixelRatio` scaling (1.4.1) is adequately crisp, and no hover/tooltip requirement is currently in scope. Worth building only if hover-detail becomes an actual requirement.
- **Typed-array (`Float64Array`/transferable `ArrayBuffer`) delta transfer** — conditional optimization noted in Section 6; only build if profiling during testing actually shows GC pressure from delta object creation at scale, not preemptively.

## 13. Full API Reference Catalog (all researched options, used or not — for future reference)

Researched via public-apis.io/GitHub public-apis lists and current (2026) comparisons. Includes every provider considered, not just adopted ones, with a description of what each actually offers — so this can be referenced later without re-researching. Providers already adopted in V1 (FRED, Finnhub, Binance, Currents, Upstash) are marked; everything else is reference only. Don't add any of these to current scope without an explicit decision, per Section 4's principle of only adding complexity that's justified.

**News**
| API | Free tier | Notes |
|---|---|---|
| Currents API | ~600–1,000 req/day, no credit card | **Adopted as V1 secondary news source** (Section 7). General news aggregator pulling from 22,000+ sources; supports keyword/category/language filters. Commercial use explicitly allowed on free tier, unlike NewsAPI. |
| NewsData.io | 200 credits/day (~2,000 articles) | General news aggregator, 100,000+ sources across 80+ languages. Commercial-safe alternative if Currents proves insufficient. |
| The Guardian Open Platform | 5,000 calls/day, genuinely free | Full access to The Guardian's own articles — headlines, body text, tags. Production-safe and generous, but single-publisher only, not broad aggregation. |
| GNews | 100 req/day | Wraps Google News results — title, description, content, source, image. Free tier is explicitly non-commercial/dev-only, same restriction that ruled out NewsAPI — avoid for this deployed project. |
| Mediastack | 100 req/**month** (not day) on true free tier, HTTP only (HTTPS requires paid plan) | Real-time/historical news from 7,500+ sources. Free tier is too limited (and HTTP-only is a security non-starter for a live site) to be usable here. |
| NewsAPI | 100 req/day | The originally-considered provider. Excellent source coverage (80,000+ sources) but free tier explicitly prohibits production/commercial deployment — this is why it was dropped in favor of Currents (Section 7). Worth knowing about since it's the most commonly referenced news API in tutorials. |
| GDELT | Free, unlimited, no key | Massive open global news/event database updated continuously, monitors the world's broadcast/print/web news. Research-grade and requires real data engineering to use well — not a quick-integration option, but worth knowing exists for a more ambitious future news/sentiment feature. |

**Macro (beyond FRED)**
| API | Free tier | Notes |
|---|---|---|
| U.S. Treasury Fiscal Data API | Free, no key | Official U.S. Treasury data — yields, debt outstanding, auction results. Pairs naturally with FRED for a more complete macro panel. |
| World Bank API | Free, no key | Global development and economic indicators (GDP, population, trade) across nearly every country — useful if scope ever goes beyond US-only macro. |
| BLS API (Bureau of Labor Statistics) | Free, key required | Source-of-truth employment/CPI/wage data at a more granular level of detail than FRED sometimes surfaces (FRED often just republishes BLS series). |
| ECB Statistical Data Warehouse | Free, no key | Eurozone macro/monetary data directly from the European Central Bank — only relevant if non-US coverage becomes a goal. |
| IMF Data API | Free, no key | International macro/financial statistics across IMF member countries — another option for non-US expansion. |

**Crypto / Forex**
| API | Free tier | Notes |
|---|---|---|
| Binance public API | Free, no key | REST + WebSocket, spot market data and order book depth. Already the Phase 1 order book source. |
| CoinGecko | Free, generous rate limits | Broad crypto market data — prices, market cap, volume, historical charts across thousands of coins. Useful if a general crypto price panel is ever added beyond the single-symbol order book. |
| Frankfurter API | Free, no key | Simple daily ECB reference forex rates, good for basic currency conversion display. |
| exchangerate.host | Free, no key | Wider currency coverage than Frankfurter, includes historical rates. |

**Equities & Fundamentals (V2 — not in current scope, see Section 11 open items)**
| API | Free tier | Notes |
|---|---|---|
| Twelve Data | 800 req/day, 4hr delayed data | Multi-asset (stocks, crypto, forex) time-series API. Stronger free-tier fit than Alpha Vantage if equities panels are ever added — this would be the default pick for V2 quotes. |
| Finnhub | 60 calls/min (already in use for news) | Also covers real-time-ish quotes (20min delay on free tier), company fundamentals, and even alt-data (social sentiment, insider transactions, congressional trading). Could extend the existing Finnhub adapter rather than adding a new provider — worth doing before reaching for Twelve Data. |
| Alpha Vantage | 25 req/**day** (tightened significantly from older tutorials/docs) | Well-known for 50+ pre-built technical indicators and daily bars. Free tier is too limited for primary/interactive use now, but fine for occasional indicator lookups if ever needed. |
| Financial Modeling Prep (FMP) | 250 req/day, 500MB/30-day bandwidth cap | Company fundamentals — income statements, balance sheets, cash flow, financial ratios — plus news, ownership, and calendars, across 70,000+ securities. The best free option specifically for "look up a company's actual financials" if a fundamentals panel is ever added; sourced from SEC EDGAR under the hood. |

**Filings / Alternative Data**
| API | Free tier | Notes |
|---|---|---|
| SEC EDGAR full-text search | Free, no key | Already in original plan (Section 1). Official U.S. filings — 10-Ks, 8-Ks, insider Form 4s — searchable full-text, no API key friction. |
| Finnhub (insider/sentiment endpoints) | Included in the 60/min free tier already in use | Same provider as news, but also exposes social sentiment scores, insider transaction (MSPR) data. Worth knowing it's already available without adding a new key. |

## 12. Full Task List (execution order — follow exactly)

### Phase 0 — Setup
- [ ] 0.1 Init Next.js (App Router) project, TypeScript enabled
- [ ] 0.2 Set up Git repo, `.gitignore` (include `.env*`)
- [ ] 0.3 Set up ESLint/Prettier baseline config
- [ ] 0.4 Sign up for FRED API key
- [ ] 0.5 Sign up for Finnhub API key
- [ ] 0.6 Sign up for Currents API key (no credit card required)
- [ ] 0.7 Sign up for Upstash Redis (free tier), get REST URL + token
- [ ] 0.8 Create `.env.local` with all keys; confirm `.env.local` is gitignored
- [ ] 0.9 Create Vercel project, link to repo, confirm env vars will be set there too (not just locally)

### Phase 1 — Streaming Order Book Subsystem (build first, per decision in Section 5)

**1.0 Web Worker bundling verification (Next.js-specific — do this before writing any reconciliation logic)**
- [ ] 1.0.1 Confirm Next.js version/bundler in use (Webpack vs Turbopack) — behavior for `new Worker(new URL(...))` differs between them and has had rough edges under Turbopack specifically
- [ ] 1.0.2 Create a trivial placeholder Worker (e.g. echoes a message back) and instantiate it from a client component using `new Worker(new URL('../workers/orderbook.worker.ts', import.meta.url))`
- [ ] 1.0.3 Verify it builds and runs correctly in both `next dev` and a production build (`next build && next start`) — dev and prod bundling can behave differently, don't assume dev working means prod will too
- [ ] 1.0.4 Confirm TypeScript compiles correctly inside the Worker file (separate tsconfig concerns can bite here — Worker context doesn't have DOM types by default, needs `lib: ["webworker"]` consideration)
- [ ] 1.0.5 Only proceed to 1.1 once this trivial Worker round-trip is confirmed working — don't build the real reconciliation logic inside a Worker setup you haven't verified actually bundles/runs

**1.1 Reconciliation logic (core hard problem — build and test before any UI)**
- [ ] 1.1.0 Write a standalone `scripts/test-reconciliation.ts`, runnable directly via `bun` or `tsx` (no Next.js/browser involved) — implement and debug the snapshot fetch, WS buffering, and gap/resync logic here first, printing state to the terminal. Debugging sequence gaps and network-drop edge cases is much faster in a plain CLI loop than inside a bundled browser Worker; only port the verified logic into the actual Worker (1.2) once this script demonstrates correct behavior end-to-end. **Include a "chaos monkey" toggle:** programmatically intercept the incoming stream and deterministically drop events (e.g. `Math.random() < 0.05`) or inject an artificial `updateId` gap on command, rather than waiting for genuine network jitter to test the U/u overlap and gap-detection logic. Waiting for real packet loss is non-deterministic and slow to reproduce; a deterministic chaos toggle lets you verify — and later demo live — that the algorithm cleanly detects the gap, dumps state, and triggers the backoff-gated resync (1.2.5) automatically, on demand.
- [ ] 1.1.1 Write function to fetch Binance REST snapshot (`lastUpdateId`, bids, asks) for BTC/USDT
- [ ] 1.1.2 Open Binance WS diff-depth stream for BTC/USDT, buffer incoming events (don't process yet)
- [ ] 1.1.3 Implement discard-stale-events logic (drop buffered events with `u <= lastUpdateId`)
- [ ] 1.1.4 Implement the first-event overlap check exactly as specified in Section 6: `U ≤ lastUpdateId+1 AND u ≥ lastUpdateId+1`
- [ ] 1.1.5 Implement contiguous-sequence validation for all subsequent events (each event's `U` should be previous event's `u + 1`)
- [ ] 1.1.6 Implement gap detection → trigger full resync (discard state, re-fetch snapshot, re-buffer)
- [ ] 1.1.7 Implement delta application: replace quantity at price level; remove level if quantity is `0`
- [ ] 1.1.8 Write standalone tests/manual verification for: normal operation, simulated gap, simulated stale/duplicate event, resync recovery
- [ ] 1.1.9 Add logging (console, or structured) for every resync event — you'll want to point to this in a demo/interview

**1.2 Web Worker wrapper**
- [ ] 1.2.1 Create `workers/orderbook.worker.ts`, move reconciliation logic inside it
- [ ] 1.2.2 Implement `postMessage` protocol exactly as specified in Section 6 (`delta`, `resync`, `error` message types)
- [ ] 1.2.3 Batch outgoing deltas — do not `postMessage` on every single incoming WS delta. During high volatility Binance can emit hundreds of events/second; posting each individually floods the main thread's message queue and causes UI stutter, defeating the point of offloading to a Worker. **Concrete implementation:**
  - Maintain a `pendingDeltas` buffer in the Worker's top-level scope — use a `Map` keyed by `` `${side}:${price}` ``, not a plain array. Multiple updates to the same price level within one flush window are common during volatility, and since Binance deltas are replace-semantics (task 1.1.7), only the latest value per level matters — a `Map` naturally collapses redundant updates to their final state, an array would just carry duplicates forward wastefully.
  - In the WS `onmessage` handler, after updating the Worker's internal order book state, also set the corresponding entry in `pendingDeltas`.
  - Run `setInterval(flush, 16)` (approx. 60fps) as the flush trigger.
  - Inside `flush`: if `pendingDeltas.size === 0`, return immediately — don't wake the main thread with an empty payload, that wastes cycles on both ends for nothing.
  - Otherwise, `postMessage({ type: 'delta', updates: Array.from(pendingDeltas.values()) })`, then immediately reassign `pendingDeltas = new Map()` so the next window starts clean. Single-threaded Worker execution means there's no race between the `postMessage` call and the reassignment — nothing else can interleave mid-function.
- [ ] 1.2.4 Handle WS disconnect/reconnect with backoff inside the Worker; emit `resync`/`error` status appropriately. **Critical:** on `onclose` or `onerror`, do not simply reopen the socket and keep applying deltas — this can silently apply updates to a sequence-corrupted book, or leak stale buffered events across the reconnect boundary. Implement an explicit `reset()` in the Worker that: purges all buffered/unapplied delta events, clears both price-level `Map`s (bids/asks) entirely, and forces the full sync procedure from Section 6 (fresh REST snapshot → buffer → discard-stale → U/u overlap check → apply) before accepting and applying any new incoming WS frames. Treat every reconnect as equivalent to a freshly detected gap, not a resume.
- [ ] 1.2.5 Add exponential backoff/cooldown specifically on resync-triggered snapshot fetches (distinct from WS reconnect backoff) — cap to roughly one resync attempt per 2-3 seconds minimum. Under sustained network jitter, repeated gaps could otherwise trigger a snapshot REST call on every single gap, which risks Binance-side rate limiting on the snapshot endpoint and makes the instability worse, not better. If gaps keep recurring past a few attempts, back off further rather than hammering the endpoint.
- [ ] 1.2.6 Verify Worker runs independently of main thread (simulate main thread being busy, confirm Worker keeps processing)

**1.3 Main thread integration**
- [ ] 1.3.1 Spawn Worker from a React component (`OrderBookPanel.tsx`), wire up `onmessage` handler — **must be done inside `useEffect`, never at module/render top-level.** Next.js renders components server-side by default, and `Worker` is a browser-only global; instantiating it during initial render (outside an effect) throws `ReferenceError: Worker is not defined` on the server. `useEffect` only runs client-side, after mount, which is the correct place for this.
- [ ] 1.3.2 Maintain order book state as a plain in-memory structure outside React state (not `useState` per tick)
- [ ] 1.3.3 Implement `requestAnimationFrame` loop that reads current state and triggers canvas redraw at most once per frame
- [ ] 1.3.4 Wire resync/error messages to a small piece of actual React state (for the stale-data badge) — this one is fine to be React state since it changes rarely

**1.4 Canvas rendering**
- [ ] 1.4.1 Set up canvas element sized appropriately, handle devicePixelRatio scaling for sharpness — specifically: read the element's CSS-rendered `rect` via `getBoundingClientRect()`, then set `canvas.width = rect.width * window.devicePixelRatio` and `canvas.height = rect.height * window.devicePixelRatio` (the actual pixel buffer, not just CSS size), keep the CSS `width`/`height` at the original unscaled values, and call `ctx.scale(devicePixelRatio, devicePixelRatio)` once before the `requestAnimationFrame` render loop begins drawing. Skipping this produces blurry depth bars and fuzzy price text on Retina/HiDPI screens — noticeable and unprofessional-looking in a live demo.
- [ ] 1.4.2 Implement depth-bar drawing: sorted bids/asks, cumulative quantity fill, best price nearest spread
- [ ] 1.4.3 Cap visible levels (~15–20 per side), confirm redraw cost stays bounded
- [ ] 1.4.4 Clamp the render loop to a target frame rate (e.g. 60fps max) using delta-time gating inside the `requestAnimationFrame` callback (track last-paint timestamp, skip the redraw if less than ~16.7ms has elapsed). `requestAnimationFrame` syncs to the monitor's native refresh rate, so on a 144Hz/240Hz display it would otherwise repaint 2-4x more often than order book data actually needs — wasted GPU/CPU cycles for data that doesn't change meaningfully faster than 60fps.
- [ ] 1.4.5 Draw best bid/ask + spread value as text overlay
- [ ] 1.4.6 Style to match dark terminal aesthetic (Section 9) — bid/ask color coding, restrained palette

**1.5 Resync/stale UI**
- [ ] 1.5.1 Build the "resyncing" badge/indicator tied to Worker status messages
- [ ] 1.5.2 Manually trigger/simulate a gap (or kill the WS briefly) to confirm the badge appears and clears correctly
- [ ] 1.5.3 Confirm the book doesn't render garbage/partial state mid-resync (show last-good state + badge, not a broken canvas)

**1.6 Verification checkpoint before moving to Phase 2**
- [ ] 1.6.1 Let it run unattended for an extended period (e.g. an hour+), confirm no drift/corruption and no memory growth from leaked listeners/state
- [ ] 1.6.2 Confirm reconnect-after-real-network-drop works (not just simulated)
- [ ] 1.6.3 Write the interview-ready explanation of this subsystem (a short paragraph you can say out loud) so it's ready before you move on

### Phase 2 — V1 Core: News + Macro

**2.1 Data layer foundation**
- [ ] 2.1.1 Define the common internal schema each provider adapter must normalize to (for news items, and separately for macro series)
- [ ] 2.1.2 Build `lib/providers/fred.ts` adapter (search + series observations)
- [ ] 2.1.3 Build `lib/providers/finnhub.ts` adapter (news)
- [ ] 2.1.4 Build `lib/providers/currents.ts` adapter (news, secondary)
- [ ] 2.1.5 Build `lib/cache.ts` — Upstash-backed get/set-with-TTL helper, keyed per query
- [ ] 2.1.6 Set distinct TTLs per provider (short for Finnhub/FRED as appropriate; aggressive 1–2hr or daily-bucketed for NewsAPI per Section 7 note)
- [ ] 2.1.7 Implement graceful degradation: on provider failure, serve last-cached value past TTL, flag response as stale
- [ ] 2.1.8 Implement basic rate-limit-aware request handling (don't hammer a provider if you know you're near its limit)
- [ ] 2.1.9 Add `@upstash/ratelimit` on top of the existing Upstash Redis instance, applied per-IP on the news/macro API routes — this protects against a cache-stampede scenario where many simultaneous visitors all cache-miss at once and each independently call FRED/Finnhub/Currents, multiplying external API usage beyond what the shared TTL cache alone prevents
- [ ] 2.1.10 Pick sane limiter thresholds per route (e.g. N requests per IP per minute) — generous enough not to block normal browsing, tight enough to stop abuse/bot traffic from draining quota

**2.2 API routes**
- [ ] 2.2.1 Build `/app/api/news/route.ts` — calls adapters + cache, returns normalized news list
- [ ] 2.2.2 Build `/app/api/macro/route.ts` — supports FRED search query param + series observation fetch
- [ ] 2.2.3 Confirm all provider API keys are only referenced server-side (never sent to client)
- [ ] 2.2.4 Wrap every upstream provider `fetch` call with an `AbortController`-based timeout (e.g. 5s) — Vercel Hobby caps function execution at 10s by default (configurable up to 60s via `maxDuration`, up to 300s with Fluid compute), so a stalled upstream call risks the whole route dying with a hard 504 instead of failing gracefully; a 5s client-side abort lets your own graceful-degradation logic (Section 7, serve stale cache) kick in well before the platform kills the function

**2.3 Command bar**
- [ ] 2.3.1 Build command input component, always visible
- [ ] 2.3.2 Implement hand-built parser for `NEWS`, `NEWS <query>`, `ECON <term>`, `HELP`
- [ ] 2.3.3 Wire commands to open/focus the relevant panel
- [ ] 2.3.4 Handle unknown commands gracefully (helpful error, not a silent no-op)

**2.4 News panel**
- [ ] 2.4.1 Build `NewsPanel.tsx` — headline list (source, timestamp, snippet)
- [ ] 2.4.2 Wire to `/api/news`, support optional keyword/ticker filter
- [ ] 2.4.3 Show "may be delayed" badge when serving stale/degraded data
- [ ] 2.4.4 Handle empty/loading/error states cleanly

**2.5 Macro panel**
- [ ] 2.5.1 Build `MacroPanel.tsx` — search input hitting `/api/macro` (FRED search)
- [ ] 2.5.2 Render search results list, selectable
- [ ] 2.5.3 On selection, fetch + render series as a line chart
- [ ] 2.5.4 Display metadata: units, frequency, last updated, source
- [ ] 2.5.5 Show pinned default series (GDP, CPI, Unemployment, Fed Funds) on initial load before any search
- [ ] 2.5.6 Show "may be delayed" badge when serving stale/degraded data

**2.6 Layout shell**
- [ ] 2.6.1 Build fixed panel grid layout (command bar + News + Macro + OrderBook panels)
- [ ] 2.6.2 Apply dark terminal visual styling consistently across all panels (Section 9)
- [ ] 2.6.3 Confirm responsive behavior is at least reasonable (doesn't need to be fully mobile-optimized, but shouldn't break)

### Phase 3 — Deployment & Polish
- [ ] 3.1 Set all env vars (API keys, Upstash credentials) in Vercel project settings
- [ ] 3.2 Deploy to Vercel, confirm build succeeds
- [ ] 3.3 Point existing custom domain at the Vercel deployment (DNS records)
- [ ] 3.4 Smoke-test all panels against the live deployment, not just localhost
- [ ] 3.5 Confirm shared caching actually behaves as expected under multiple concurrent visitors (test from two devices/networks if possible), and confirm the `@upstash/ratelimit` per-IP limits (2.1.9) don't false-positive on normal single-user browsing while still capping abusive traffic
- [ ] 3.6 Test graceful degradation live: temporarily invalidate an API key and confirm panels degrade cleanly instead of breaking
- [ ] 3.7 Cross-browser/basic device check (the order book Worker/Canvas piece especially — confirm it works outside just your dev browser)

### Phase 4 — Documentation (for the actual interview pitch)
- [ ] 4.1 Write README: what it is, what it deliberately is NOT (Section 1 framing), how to run it
- [ ] 4.2 Write/diagram the architecture (data layer, streaming subsystem) — this is what prompts interviewers to ask about the parts you want to talk about
- [ ] 4.3 Document the key decisions log (Section 10) in the README or a linked doc, in your own words
- [ ] 4.4 Add the live URL + a short demo GIF/screenshot to the README
- [ ] 4.5 Final pass: confirm nothing in the README overclaims data parity with real Bloomberg (per Section 1 framing)

## 14. V2 Considerations (keep in mind while building V1, don't build now)

The point of this section is **not** to add scope to V1 — it's to make small, cheap decisions now that avoid expensive rework later. Each item below is a "leave a door open" note, not a task. See Section 11 for the full consolidated list of *what* might come later; this section is about *how* to build V1 so those things stay cheap when their time comes.

**Order book — multi-symbol support**
- Keep the Worker's internal state keyed by symbol from the start internally (e.g. `Map<symbol, {bids, asks, lastUpdateId}>`) even though only one symbol (BTC/USDT) is active in V1 — this costs almost nothing now and avoids a structural rewrite later when adding a second symbol.
- Keep the `postMessage` protocol (Section 6) tagged with `symbol` on every message, even though the main thread only listens for one right now — the wire format shouldn't need to change when multi-symbol lands.
- Don't hardcode "BTC/USDT" as a magic string throughout the codebase — pull it from one config constant so swapping/adding symbols later is a config change, not a find-and-replace.
- This is also the point where RxJS (Section 10) becomes worth evaluating, for composing multiple concurrent streams — not needed now.

**Data layer — equities/forex expansion**
- The provider-adapter pattern (Section 7, `lib/providers/`) is already designed to make this easy — adding Twelve Data or extending the existing Finnhub adapter for quotes (Section 13) should mean writing one new adapter file, not touching the cache/route/panel architecture.
- Keep the internal normalized schema (2.1.1) intentionally a little more generic than "just news and macro" if it's easy to do — e.g. a shared `{title, timestamp, source}` shape for news-like items is fine to keep narrow, but avoid baking macro-specific assumptions (like "always has units/frequency") into shared code paths that a future quotes panel would also need to pass through.

**Command bar — extensibility**
- Structure the command parser (2.3.2) as a simple registry/map of `command → handler`, not a chain of if/else string checks — adding a new command later (e.g. `QUOTE <ticker>` for V2 equities) should mean registering one new entry, not editing parsing logic.

**Layout shell — more panels**
- Even though the grid is fixed for V1 (Section 4, explicitly deferring dockable panels), avoid hardcoding "exactly 3 panels" assumptions into the layout component — a simple array-of-panels render, even in a fixed grid, makes adding a 4th/5th panel (e.g. equities) later a data change, not a layout rewrite. This doesn't mean building dockable panels now — just don't paint yourself into a 3-panel-only corner.

**Caching layer**
- Keep cache keys structured consistently (e.g. `<provider>:<query>`) from the start — this makes it trivial to add a new provider's cache entries later without inventing a new key scheme, and makes it easy to inspect/debug what's cached per-provider in Upstash's dashboard.

**What NOT to do now**
- Don't build equities panels, dockable layout, or command autocomplete now — all of the above is about *not blocking* these later, not about building them early. Building any of them now re-introduces the exact scope-creep risk flagged in Section 4 and Section 5. The goal is a V1 that's honest about being V1, but doesn't require painful rework to become V2.