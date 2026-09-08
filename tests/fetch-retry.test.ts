import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isRetryableStatus,
  calculateBackoffDelay,
  fetchWithRetry,
  fetchJsonWithRetry,
} from "../lib/fetchWithRetry";

describe("fetchWithRetry utility", () => {
  describe("isRetryableStatus", () => {
    it("identifies 408, 429, and 5xx as retryable", () => {
      expect(isRetryableStatus(408)).toBe(true);
      expect(isRetryableStatus(429)).toBe(true);
      expect(isRetryableStatus(500)).toBe(true);
      expect(isRetryableStatus(502)).toBe(true);
      expect(isRetryableStatus(503)).toBe(true);
      expect(isRetryableStatus(504)).toBe(true);
    });

    it("rejects permanent client errors 400, 401, 403, 404 as non-retryable", () => {
      expect(isRetryableStatus(400)).toBe(false);
      expect(isRetryableStatus(401)).toBe(false);
      expect(isRetryableStatus(403)).toBe(false);
      expect(isRetryableStatus(404)).toBe(false);
      expect(isRetryableStatus(200)).toBe(false);
    });
  });

  describe("calculateBackoffDelay", () => {
    it("calculates exponential growth without jitter", () => {
      const d0 = calculateBackoffDelay(0, 100, 2000, 2, false);
      const d1 = calculateBackoffDelay(1, 100, 2000, 2, false);
      const d2 = calculateBackoffDelay(2, 100, 2000, 2, false);
      const d3 = calculateBackoffDelay(3, 100, 2000, 2, false);

      expect(d0).toBe(100);
      expect(d1).toBe(200);
      expect(d2).toBe(400);
      expect(d3).toBe(800);
    });

    it("caps delay at maxDelayMs", () => {
      const d = calculateBackoffDelay(10, 100, 1500, 2, false);
      expect(d).toBe(1500);
    });

    it("applies jitter within 50% to 100% range", () => {
      for (let i = 0; i < 20; i++) {
        const d = calculateBackoffDelay(2, 100, 2000, 2, true);
        expect(d).toBeGreaterThanOrEqual(200); // 400 * 0.5
        expect(d).toBeLessThanOrEqual(400); // 400 * 1.0
      }
    });
  });

  describe("fetchWithRetry execution", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    });

    it("succeeds on first attempt without retrying", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const promise = fetchJsonWithRetry<{ success: boolean }>("/api/test");
      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.success).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("retries on transient 503 and recovers on 3rd attempt", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(new Response("Service Unavailable", { status: 503, statusText: "Service Unavailable" }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ recovered: true }), { status: 200 })
        );
      });

      const onRetry = vi.fn();
      const promise = fetchJsonWithRetry<{ recovered: boolean }>("/api/transient", undefined, {
        retries: 3,
        initialDelayMs: 50,
        jitter: false,
        onRetry,
      });

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.recovered).toBe(true);
      expect(callCount).toBe(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it("does not retry on permanent 400 Bad Request error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Invalid syntax" }), { status: 400, statusText: "Bad Request" })
      );

      const onRetry = vi.fn();
      const promise = fetchWithRetry("/api/bad-input", undefined, {
        retries: 3,
        initialDelayMs: 50,
        onRetry,
      });

      await vi.runAllTimersAsync();
      const res = await promise;

      expect(res.status).toBe(400);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });
  });
});
