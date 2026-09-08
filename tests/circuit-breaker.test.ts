import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker, getCircuitBreaker, resetAllCircuitBreakers } from "../lib/circuitBreaker";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
  });

  it("initializes in CLOSED state", () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.isOpen()).toBe(false);
  });

  it("transitions to OPEN after threshold failures", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);

    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
    expect(cb.getState()).toBe("OPEN");
  });

  it("transitions to HALF_OPEN after cooldown period", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 50 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cb.getState()).toBe("HALF_OPEN");
  });

  it("recovers to CLOSED on success", () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    cb.recordSuccess();
    expect(cb.isOpen()).toBe(false);
    expect(cb.getState()).toBe("CLOSED");
  });

  it("resets failure counter on manual reset", () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    cb.recordFailure();
    cb.reset();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
  });

  it("caches breakers per normalized route key", () => {
    const cb1 = getCircuitBreaker("https://api.example.com/data?token=abc");
    const cb2 = getCircuitBreaker("https://api.example.com/data?token=xyz");
    expect(cb1).toBe(cb2);
  });
});

