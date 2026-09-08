import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { withApiProtection } from "../lib/withApiProtection";

describe("withApiProtection middleware", () => {
  it("allows requests under the rate limit", async () => {
    const handler = withApiProtection(async () => {
      return NextResponse.json({ ok: true });
    }, { limit: 5 });

    const req = new NextRequest("http://localhost:3000/api/test-route", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(res.headers.get("RateLimit-Limit")).toBe("5");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const handler = withApiProtection(async () => {
      return NextResponse.json({ ok: true });
    }, { limit: 2, windowMs: 10000 });

    const req1 = new NextRequest("http://localhost:3000/api/test-limit", {
      headers: { "x-forwarded-for": "10.0.0.2" },
    });

    await handler(req1);
    await handler(req1);
    const res3 = await handler(req1);

    expect(res3.status).toBe(429);
    const body = await res3.json();
    expect(body.error).toContain("Rate limit exceeded");
  });

  it("sets RateLimit-Remaining headers accurately", async () => {
    const handler = withApiProtection(async () => {
      return NextResponse.json({ ok: true });
    }, { limit: 10 });

    const req = new NextRequest("http://localhost:3000/api/test-headers", {
      headers: { "x-forwarded-for": "10.0.0.3" },
    });

    const res = await handler(req);
    expect(res.headers.get("RateLimit-Remaining")).toBe("9");
  });
});

