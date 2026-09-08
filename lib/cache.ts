import { Redis } from "@upstash/redis";

type CachedValue<T> = { value: T; expiresAt: number };

const memoryCache = new Map<string, CachedValue<unknown>>();
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? Redis.fromEnv()
  : null;

export async function getCached<T>(key: string): Promise<{ value: T; stale: boolean } | null> {
  if (redis) {
    try {
      const cached = await redis.get<{ value: T; expiresAt: number }>(key);
      if (cached) return { value: cached.value, stale: cached.expiresAt < Date.now() };
      return null;
    } catch {
      // Fall through to the process-local cache when Redis is unavailable.
    }
  }

  const cached = memoryCache.get(key) as CachedValue<T> | undefined;
  if (!cached) return null;
  return { value: cached.value, stale: cached.expiresAt < Date.now() };
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  if (redis) {
    try {
      // Store in Upstash Redis with a 5x TTL retention buffer (minimum 1 day)
      // This allows getCached to serve stale data (stale: true) when upstream APIs fail
      const redisTtl = Math.max(ttlSeconds * 5, 86400);
      await redis.set(key, { value, expiresAt }, { ex: redisTtl });
      return;
    } catch {
      // Keep serving this instance if the shared cache is unavailable.
    }
  }
  memoryCache.set(key, { value, expiresAt });
}
