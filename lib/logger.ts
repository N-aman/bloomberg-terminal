export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  attempt?: number;
  maxRetries?: number;
  delayMs?: number;
  durationMs?: number;
  error?: Record<string, unknown> | string;
  meta?: Record<string, unknown>;
};

export function formatLogLine(entry: LogEntry): string {
  return `[${entry.timestamp}] [${entry.level.padEnd(5)}] [${entry.context}] ${entry.message}${
    entry.error ? ` | Error: ${typeof entry.error === "object" ? JSON.stringify(entry.error) : entry.error}` : ""
  }${entry.meta ? ` | Meta: ${JSON.stringify(entry.meta)}` : ""}`;
}

/**
 * Structured logger following 12-factor application & Vercel serverless logging standards.
 * Formats log entries and writes directly to standard output/error streams.
 */
export function writeLog(entry: Omit<LogEntry, "timestamp"> & { timestamp?: string }): string {
  const fullEntry: LogEntry = {
    timestamp: entry.timestamp || new Date().toISOString(),
    ...entry,
  };

  const formattedLine = formatLogLine(fullEntry);

  if (fullEntry.level === "ERROR" || fullEntry.level === "FATAL") {
    console.error(formattedLine);
  } else if (fullEntry.level === "WARN") {
    console.warn(formattedLine);
  } else {
    console.log(formattedLine);
  }

  return formattedLine;
}

export const logger = {
  debug: (context: string, message: string, meta?: Record<string, unknown>) =>
    writeLog({ level: "DEBUG", context, message, meta }),
  info: (context: string, message: string, meta?: Record<string, unknown>) =>
    writeLog({ level: "INFO", context, message, meta }),
  warn: (context: string, message: string, meta?: Record<string, unknown>) =>
    writeLog({ level: "WARN", context, message, meta }),
  error: (
    context: string,
    message: string,
    error?: Record<string, unknown> | string,
    meta?: Record<string, unknown>
  ) => writeLog({ level: "ERROR", context, message, error, meta }),
  fatal: (
    context: string,
    message: string,
    error?: Record<string, unknown> | string,
    meta?: Record<string, unknown>
  ) => writeLog({ level: "FATAL", context, message, error, meta }),
};
