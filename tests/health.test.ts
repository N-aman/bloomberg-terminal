import { describe, it, expect } from "vitest";
import { GET } from "../app/api/health/route";

describe("Health API Route", () => {
  it("returns healthy status with system uptime and providers", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(typeof data.uptime).toBe("number");
    expect(data.timestamp).toBeDefined();
    expect(data.providers).toBeDefined();
    expect(data.providers.binance).toBe("up");
  });
});

