/**
 * Global Foreign Exchange Provider
 * Primary: open.er-api.com (160+ currencies, real-time reference rates)
 * Fallback: api.frankfurter.app (ECB reference rates for 31 currencies)
 */

import { MAJOR_CURRENCY_CODES, WORLD_CURRENCIES, CURRENCY_MAP } from "../currencies";

export type FxRate = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

const OPEN_ER_URL = "https://open.er-api.com/v6/latest";
const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

export { MAJOR_CURRENCY_CODES, WORLD_CURRENCIES, CURRENCY_MAP };

export async function fetchFxRates(
  signal?: AbortSignal,
  from: string = "USD",
  to?: string[]
): Promise<FxRate> {
  const base = from.trim().toUpperCase() || "USD";

  // Try Open.er-api first (supports 160+ currencies)
  try {
    const url = `${OPEN_ER_URL}/${encodeURIComponent(base)}`;
    const response = await fetch(url, { signal });
    if (response.ok) {
      const data = await response.json() as {
        result: string;
        base_code: string;
        rates: Record<string, number>;
        time_last_update_utc?: string;
      };

      if (data.result === "success" && data.rates) {
        let filteredRates = data.rates;

        // If specific target currencies are requested, filter to them
        if (to && to.length > 0) {
          const selected: Record<string, number> = {};
          for (const target of to) {
            const code = target.trim().toUpperCase();
            if (filteredRates[code] !== undefined) {
              selected[code] = filteredRates[code];
            }
          }
          filteredRates = selected;
        }

        const dateStr = data.time_last_update_utc
          ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        return {
          base: data.base_code || base,
          date: dateStr,
          rates: filteredRates,
        };
      }
    }
  } catch {
    // Fall through to Frankfurter
  }

  // Fallback to Frankfurter (ECB 31 currencies)
  const targetParam = to && to.length > 0 ? `&to=${to.join(",")}` : "";
  const fallbackUrl = `${FRANKFURTER_URL}?from=${encodeURIComponent(base)}${targetParam}`;
  const fbRes = await fetch(fallbackUrl, { signal });
  if (!fbRes.ok) throw new Error(`FX fetch failed for ${base}: ${fbRes.status}`);
  const fbData = (await fbRes.json()) as FxRate;
  return fbData;
}
