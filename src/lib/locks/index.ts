/**
 * Lease-based locks / semaphores (brief Parts 18 + 23).
 * memory driver for single-process; redis when LOCK_DRIVER=redis + REDIS_URL.
 */

import { getRedisUrl } from "@/lib/queue/config";

export type LockDriverName = "memory" | "redis";

export function getLockDriverName(): LockDriverName {
  const raw = (process.env.LOCK_DRIVER ?? "memory").trim().toLowerCase();
  if (raw === "redis") return "redis";
  return "memory";
}

export type Lease = {
  key: string;
  token: string;
  release: () => Promise<void>;
  extend: (ttlMs: number) => Promise<boolean>;
};

type MemoryLock = { token: string; expiresAt: number };

const memoryLocks = new Map<string, MemoryLock>();
const memorySemaphores = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function newToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function acquireMemoryLock(key: string, ttlMs: number, timeoutMs: number): Promise<Lease> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = Date.now();
    const existing = memoryLocks.get(key);
    if (!existing || existing.expiresAt <= now) {
      const token = newToken();
      memoryLocks.set(key, { token, expiresAt: now + ttlMs });
      return {
        key,
        token,
        release: async () => {
          const cur = memoryLocks.get(key);
          if (cur?.token === token) memoryLocks.delete(key);
        },
        extend: async (nextTtl) => {
          const cur = memoryLocks.get(key);
          if (!cur || cur.token !== token) return false;
          cur.expiresAt = Date.now() + nextTtl;
          return true;
        },
      };
    }
    await sleep(25);
  }
  throw new Error(`Lock timeout: ${key}`);
}

async function acquireRedisLock(key: string, ttlMs: number, timeoutMs: number): Promise<Lease> {
  const url = getRedisUrl();
  if (!url) return acquireMemoryLock(key, ttlMs, timeoutMs);
  const IORedis = (await import("ioredis")).default;
  const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  if (redis.status === "wait") await redis.connect();
  const redisKey = `lock:${key}`;
  const token = newToken();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await redis.set(redisKey, token, "PX", ttlMs, "NX");
    if (ok === "OK") {
      return {
        key,
        token,
        release: async () => {
          const cur = await redis.get(redisKey);
          if (cur === token) await redis.del(redisKey);
          await redis.quit().catch(() => {});
        },
        extend: async (nextTtl) => {
          const cur = await redis.get(redisKey);
          if (cur !== token) return false;
          await redis.pexpire(redisKey, nextTtl);
          return true;
        },
      };
    }
    await sleep(25);
  }
  await redis.quit().catch(() => {});
  throw new Error(`Lock timeout: ${key}`);
}

/** Acquire an exclusive lease. Always release or extend; crashes expire via TTL. */
export async function acquireLock(
  key: string,
  opts: { ttlMs?: number; timeoutMs?: number } = {}
): Promise<Lease> {
  const ttlMs = opts.ttlMs ?? 30_000;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  if (getLockDriverName() === "redis" && getRedisUrl()) {
    return acquireRedisLock(key, ttlMs, timeoutMs);
  }
  return acquireMemoryLock(key, ttlMs, timeoutMs);
}

/**
 * Simple counting semaphore (in-process for memory driver).
 * For Redis, uses INCR with TTL safety on idle keys.
 */
export async function withSemaphore<T>(
  key: string,
  max: number,
  fn: () => Promise<T>,
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;

  if (getLockDriverName() === "redis" && getRedisUrl()) {
    const IORedis = (await import("ioredis")).default;
    const redis = new IORedis(getRedisUrl()!, { maxRetriesPerRequest: 1, lazyConnect: true });
    if (redis.status === "wait") await redis.connect();
    const redisKey = `sem:${key}`;
    try {
      while (Date.now() < deadline) {
        const n = await redis.incr(redisKey);
        if (n === 1) await redis.expire(redisKey, 120);
        if (n <= max) {
          try {
            return await fn();
          } finally {
            await redis.decr(redisKey).catch(() => {});
          }
        }
        await redis.decr(redisKey);
        await sleep(20);
      }
      throw new Error(`Semaphore timeout: ${key}`);
    } finally {
      await redis.quit().catch(() => {});
    }
  }

  while (Date.now() < deadline) {
    const cur = memorySemaphores.get(key) ?? 0;
    if (cur < max) {
      memorySemaphores.set(key, cur + 1);
      try {
        return await fn();
      } finally {
        memorySemaphores.set(key, Math.max(0, (memorySemaphores.get(key) ?? 1) - 1));
      }
    }
    await sleep(20);
  }
  throw new Error(`Semaphore timeout: ${key}`);
}

/** Tenant-safe lock key. */
export function tenantLockKey(
  organizationId: string,
  resource: string,
  id?: string
): string {
  return id ? `org:${organizationId}:${resource}:${id}` : `org:${organizationId}:${resource}`;
}
