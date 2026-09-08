export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validateTicker(raw: string | null | undefined, defaultTicker = "AAPL"): ValidationResult<string> {
  if (!raw || typeof raw !== "string") {
    return { success: true, data: defaultTicker };
  }
  const clean = raw.trim().toUpperCase();
  if (!/^[A-Z0-9.\-_]{1,15}$/.test(clean)) {
    return { success: false, error: `Invalid ticker format: "${raw.slice(0, 20)}"` };
  }
  return { success: true, data: clean };
}

export function validateSearchQuery(raw: string | null | undefined, maxLength = 100): ValidationResult<string> {
  if (!raw || typeof raw !== "string") {
    return { success: true, data: "" };
  }
  const clean = raw.trim().replace(/[\x00-\x1F\x7F]/g, "").slice(0, maxLength);
  return { success: true, data: clean };
}

export function validateIntegerParam(
  raw: string | null | undefined,
  min: number,
  max: number,
  defaultValue: number
): ValidationResult<number> {
  if (!raw || typeof raw !== "string") {
    return { success: true, data: defaultValue };
  }
  const num = parseInt(raw, 10);
  if (isNaN(num) || num < min || num > max) {
    return { success: false, error: `Parameter must be an integer between ${min} and ${max}` };
  }
  return { success: true, data: num };
}

