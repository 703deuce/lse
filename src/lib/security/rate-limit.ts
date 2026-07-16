/** Simple per-process sliding-window rate limiter for expensive API routes. */

const buckets = new Map<string, number[]>();

export function assertRateLimit(params: {
  key: string;
  maxPerWindow?: number;
  windowMs?: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const max = params.maxPerWindow ?? 10;
  const windowMs = params.windowMs ?? 60_000;
  const now = Date.now();
  const prev = (buckets.get(params.key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    const retryAfterMs = Math.max(50, windowMs - (now - (prev[0] ?? now)));
    buckets.set(params.key, prev);
    return { ok: false, retryAfterMs };
  }
  prev.push(now);
  buckets.set(params.key, prev);
  if (buckets.size > 10_000) {
    for (const [k, times] of buckets) {
      const kept = times.filter((t) => now - t < windowMs);
      if (!kept.length) buckets.delete(k);
      else buckets.set(k, kept);
    }
  }
  return { ok: true };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
