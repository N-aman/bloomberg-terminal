/**
 * Unit tests for the cache module (stale-while-revalidate pattern & TTL).
 */

import { describe, it, expect } from "vitest";
import { getCached, setCached } from "../lib/cache";

describe("Cache Module (In-Memory Fallback & SWR)", () => {
  it("returns null for non-existent cache keys", async () => {
    const result = await getCached("non:existent:key:12345");
    expect(result).toBeNull();
  });

  it("stores and retrieves fresh values", async () => {
    const key = "test:fresh:key";
    const data = { hello: "world", count: 42 };

    await setCached(key, data, 60); // 60s TTL
    const cached = await getCached<typeof data>(key);

    expect(cached).not.toBeNull();
    expect(cached?.value).toEqual(data);
    expect(cached?.stale).toBe(false);
  });

  it("identifies expired values as stale (stale-while-revalidate)", async () => {
    const key = "test:stale:key";
    const data = { status: "expired-data" };

    // Set with negative TTL so it expires immediately
    await setCached(key, data, -1);
    const cached = await getCached<typeof data>(key);

    expect(cached).not.toBeNull();
    expect(cached?.value).toEqual(data);
    expect(cached?.stale).toBe(true);
  });
});

