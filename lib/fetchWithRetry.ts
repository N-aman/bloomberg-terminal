import { getCircuitBreaker } from "./circuitBreaker";

export type RetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  context?: string;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
};

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  retries: 3,
  initialDelayMs: 500,
  maxDelayMs: 4000,
  backoffFactor: 2,
  jitter: true,
  context: "CLIENT:FETCH",
};

/**
 * Sanitize URL for logging to prevent leaking query params, API keys, or sensitive tickers.
 */
export function sanitizeUrlForLogging(urlStr: string): string {
  try {
    const parsed = new URL(urlStr, "http://localhost");
    return parsed.pathname;
  } catch {
    return urlStr.split("?")[0];
  }
}

/**
 * Determine if an HTTP status is retryable (transient server/network failures).
 * Note: 404 is deliberately NOT retried.
 */
export function isRetryableStatus(status: number): boolean {
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504    // Gateway Timeout
  );
}

/**
 * Calculate exponential backoff delay with optional full jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number = 500,
  maxDelayMs: number = 4000,
  backoffFactor: number = 2,
  useJitter: boolean = true
): number {
  const rawDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
  const cappedDelay = Math.min(rawDelay, maxDelayMs);
  if (!useJitter) return cappedDelay;
  // Full jitter: random between 50% and 100% of capped delay
  return Math.round(cappedDelay * (0.5 + Math.random() * 0.5));
}

/**
 * Send telemetry to /api/logs asynchronously (fire and forget).
 */
function sendLog(payload: Record<string, unknown>): void {
  try {
    if (typeof window !== "undefined") {
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {
    // Ignore logging dispatch failures
  }
}

/**
 * Fetch wrapper with full exponential backoff retry mechanics, circuit breaking,
 * and sanitized telemetry.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const urlStr = typeof input === "string" ? input : input.toString();
  const sanitizedUrl = sanitizeUrlForLogging(urlStr);

  const breaker = getCircuitBreaker(sanitizedUrl);
  if (breaker.isOpen()) {
    const errorMsg = `Circuit breaker OPEN for ${sanitizedUrl}. Fast-failing.`;
    sendLog({
      level: "WARN",
      context: config.context,
      message: errorMsg,
    });
    throw new Error(errorMsg);
  }

  let attempt = 0;

  while (attempt <= config.retries) {
    const startTime = Date.now();
    try {
      const response = await fetch(input, init);

      if (response.ok) {
        breaker.recordSuccess();
        if (attempt > 0) {
          sendLog({
            level: "INFO",
            context: config.context,
            message: `Recovered on attempt ${attempt + 1}/${config.retries + 1} for ${sanitizedUrl}`,
            durationMs: Date.now() - startTime,
          });
        }
        return response;
      }

      // Check if status is eligible for retry
      if (isRetryableStatus(response.status) && attempt < config.retries) {
        const delayMs = calculateBackoffDelay(
          attempt,
          config.initialDelayMs,
          config.maxDelayMs,
          config.backoffFactor,
          config.jitter
        );

        sendLog({
          level: "WARN",
          context: config.context,
          message: `Transient HTTP ${response.status} on attempt ${attempt + 1}/${config.retries + 1} for ${sanitizedUrl}. Retrying in ${delayMs}ms`,
          attempt: attempt + 1,
          maxRetries: config.retries + 1,
          delayMs,
          error: { status: response.status, statusText: response.statusText },
        });

        if (config.onRetry) {
          config.onRetry(attempt + 1, delayMs, new Error(`HTTP ${response.status}`));
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }

      // Non-retryable HTTP error or exhausted retries
      if (response.status >= 500) {
        breaker.recordFailure();
      }
      sendLog({
        level: "ERROR",
        context: config.context,
        message: `HTTP ${response.status} on ${sanitizedUrl} (attempt ${attempt + 1}/${config.retries + 1})`,
        error: { status: response.status, statusText: response.statusText },
      });
      return response;
    } catch (err: unknown) {
      const isLast = attempt >= config.retries;
      const delayMs = calculateBackoffDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffFactor,
        config.jitter
      );

      if (!isLast) {
        sendLog({
          level: "WARN",
          context: config.context,
          message: `Network failure on attempt ${attempt + 1}/${config.retries + 1} for ${sanitizedUrl}. Retrying in ${delayMs}ms`,
          attempt: attempt + 1,
          delayMs,
          error: err instanceof Error ? err.message : String(err),
        });

        if (config.onRetry) {
          config.onRetry(attempt + 1, delayMs, err);
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
      } else {
        breaker.recordFailure();
        sendLog({
          level: "ERROR",
          context: config.context,
          message: `Exhausted retries (${config.retries + 1}) for ${sanitizedUrl}`,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    }
  }

  breaker.recordFailure();
  throw new Error(`fetchWithRetry: Max retries exceeded for ${sanitizedUrl}`);
}

/**
 * Convenience helper that fetches with exponential backoff and returns parsed JSON.
 */
export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions
): Promise<T> {
  const res = await fetchWithRetry(input, init, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
