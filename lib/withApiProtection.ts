/**
 * API Protection & In-Memory Rate Limiting Middleware
 * Enforces sliding window rate limits per IP and route with cost classes (low/medium/high).
 * Emits standard RateLimit-* and Retry-After HTTP headers on 429 responses.
 */
import { NextRequest, NextResponse } from "next/server";

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitTracker>();

export interface ApiProtectionOptions {
  costClass?: "low" | "medium" | "high";
  limit?: number;
  windowMs?: number;
}

export function withApiProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: ApiProtectionOptions = {}
) {
  const {
    costClass = "medium",
    limit = costClass === "high" ? 30 : costClass === "medium" ? 60 : 120,
    windowMs = 60000,
  } = options;

  return async function protectedHandler(request: NextRequest): Promise<NextResponse> {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const key = `${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();
    let tracker = memoryStore.get(key);

    if (!tracker || now > tracker.resetAt) {
      tracker = { count: 1, resetAt: now + windowMs };
      memoryStore.set(key, tracker);
    } else {
      tracker.count++;
    }

    if (tracker.count > limit) {
      const retryAfter = Math.ceil((tracker.resetAt - now) / 1000);
      return NextResponse.json(
        { error: "Rate limit exceeded. Too many requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "RateLimit-Limit": String(limit),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": String(retryAfter),
          },
        }
      );
    }

    const response = await handler(request);
    response.headers.set("RateLimit-Limit", String(limit));
    response.headers.set("RateLimit-Remaining", String(Math.max(0, limit - tracker.count)));
    response.headers.set("RateLimit-Reset", String(Math.ceil((tracker.resetAt - now) / 1000)));

    return response;
  };
}

