import { describe, it, expect, vi } from "vitest";
import { writeLog, logger, formatLogLine } from "../lib/logger";

describe("structured logger", () => {
  it("formats log entries with ISO timestamp, level, context and metadata", () => {
    const formatted = formatLogLine({
      timestamp: "2026-09-01T00:00:00.000Z",
      level: "INFO",
      context: "TEST:FORMAT",
      message: "Formatting verification",
      meta: { ticker: "AAPL" },
    });

    expect(formatted).toContain("[2026-09-01T00:00:00.000Z]");
    expect(formatted).toContain("[INFO ]");
    expect(formatted).toContain("[TEST:FORMAT]");
    expect(formatted).toContain("Formatting verification");
    expect(formatted).toContain('{"ticker":"AAPL"}');
  });

  it("writes formatted log entries to stdout via console.log for INFO", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const testMessage = `Test audit log message ${Date.now()}`;
    logger.info("TEST:SUITE", testMessage, { env: "vitest" });

    expect(consoleSpy).toHaveBeenCalled();
    const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
    expect(lastCall).toContain("[INFO ]");
    expect(lastCall).toContain("[TEST:SUITE]");
    expect(lastCall).toContain(testMessage);

    consoleSpy.mockRestore();
  });

  it("records error entries with error details to stderr via console.error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const errMessage = `Error audit log ${Date.now()}`;
    logger.error("TEST:ERROR", errMessage, { code: "ERR_NETWORK_TIMEOUT", status: 504 });

    expect(errorSpy).toHaveBeenCalled();
    const lastCall = errorSpy.mock.calls[errorSpy.mock.calls.length - 1][0];
    expect(lastCall).toContain("[ERROR]");
    expect(lastCall).toContain("[TEST:ERROR]");
    expect(lastCall).toContain(errMessage);
    expect(lastCall).toContain("ERR_NETWORK_TIMEOUT");

    errorSpy.mockRestore();
  });
});
