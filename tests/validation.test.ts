import { describe, it, expect } from "vitest";
import { validateTicker, validateSearchQuery, validateIntegerParam } from "../lib/validation";

describe("Input Validation Suite (lib/validation.ts)", () => {
  describe("validateTicker", () => {
    it("accepts valid equity tickers", () => {
      expect(validateTicker("AAPL")).toEqual({ success: true, data: "AAPL" });
      expect(validateTicker("msft")).toEqual({ success: true, data: "MSFT" });
      expect(validateTicker("BRK.A")).toEqual({ success: true, data: "BRK.A" });
      expect(validateTicker("BTC-USD")).toEqual({ success: true, data: "BTC-USD" });
    });

    it("falls back to default ticker when empty or null", () => {
      expect(validateTicker(null, "AAPL")).toEqual({ success: true, data: "AAPL" });
      expect(validateTicker("", "NVDA")).toEqual({ success: true, data: "NVDA" });
      expect(validateTicker(undefined, "SPY")).toEqual({ success: true, data: "SPY" });
    });

    it("rejects malicious or invalid ticker inputs", () => {
      expect(validateTicker("AAPL<script>").success).toBe(false);
      expect(validateTicker("AAPL; DROP TABLE").success).toBe(false);
      expect(validateTicker("VERY_LONG_TICKER_NAME_OVER_15_CHARS").success).toBe(false);
    });
  });

  describe("validateSearchQuery", () => {
    it("sanitizes control characters and trims query", () => {
      expect(validateSearchQuery("  apple  ")).toEqual({ success: true, data: "apple" });
      expect(validateSearchQuery("test\x00\x1F")).toEqual({ success: true, data: "test" });
    });

    it("truncates queries longer than maxLength", () => {
      const longQuery = "a".repeat(150);
      const res = validateSearchQuery(longQuery, 50);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.length).toBe(50);
      }
    });

    it("handles null and undefined gracefully", () => {
      expect(validateSearchQuery(null)).toEqual({ success: true, data: "" });
      expect(validateSearchQuery(undefined)).toEqual({ success: true, data: "" });
    });
  });

  describe("validateIntegerParam", () => {
    it("parses valid integers within range", () => {
      expect(validateIntegerParam("30", 1, 100, 10)).toEqual({ success: true, data: 30 });
      expect(validateIntegerParam("1", 1, 10, 5)).toEqual({ success: true, data: 1 });
      expect(validateIntegerParam("10", 1, 10, 5)).toEqual({ success: true, data: 10 });
    });

    it("returns default value when param is missing", () => {
      expect(validateIntegerParam(null, 1, 100, 25)).toEqual({ success: true, data: 25 });
      expect(validateIntegerParam("", 1, 100, 50)).toEqual({ success: true, data: 50 });
    });

    it("rejects non-integers or out-of-range values", () => {
      expect(validateIntegerParam("0", 1, 100, 10).success).toBe(false);
      expect(validateIntegerParam("150", 1, 100, 10).success).toBe(false);
      expect(validateIntegerParam("abc", 1, 100, 10).success).toBe(false);
    });
  });
});

