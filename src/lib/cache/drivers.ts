import type { CacheDriver, CacheSetOptions } from "@/lib/cache/types";
import { getRedisUrl } from "@/lib/queue/config";

type MemoryEntry = { value: unknown; expiresAt: number };

function withJitter(ttlMs: number, jitterRatio = 0.1): number {
  const jitter = Math.floor(ttlMs * jitterRatio * Math.random());
  return Math.max(1, ttlMs + jitter);
}

export function createNoneCache(): CacheDriver {
  return {
    async get() {
      return null;
    },
    async set() {},
    async del() {},
    async getOrSet(_key, factory) {
      return factory();
    },
  };
}

export function createMemoryCache(): CacheDriver {
  const store = new Map<string, MemoryEntry>();
  const inflight = new Map<string, Promise<unknown>>();

  return {
    async get<T>(key: string) {
      const row = store.get(key);
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return row.value as T;
    },
    async set<T>(key: string, value: T, opts: CacheSetOptions) {
      store.set(key, {
        value,
        expiresAt: Date.now() + withJitter(opts.ttlMs, opts.jitterRatio),
      });
    },
    async del(key: string) {
      store.delete(key);
      inflight.delete(key);
    },
    async getOrSet<T>(key: string, factory: () => Promise<T>, opts: CacheSetOptions) {
      const hit = await this.get<T>(key);
      if (hit != null) return hit;
      const existing = inflight.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const pending = factory()
        .then(async (value) => {
          await this.set(key, value, opts);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
      return pending;
    },
  };
}

export function createRedisCache(): CacheDriver {
  const url = getRedisUrl();
  if (!url) return createMemoryCache();

  let clientPromise: Promise<import("ioredis").default> | null = null;
  const inflight = new Map<string, Promise<unknown>>();

  async function client() {
    if (!clientPromise) {
      clientPromise = import("ioredis").then(({ default: IORedis }) => {
        return new IORedis(url!, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: true,
        });
      });
    }
    const c = await clientPromise;
    if (c.status === "wait") await c.connect();
    return c;
  }

  return {
    async get<T>(key: string) {
      try {
        const c = await client();
        const raw = await c.get(`cache:${key}`);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T, opts: CacheSetOptions) {
      try {
        const c = await client();
        const ttl = withJitter(opts.ttlMs, opts.jitterRatio);
        await c.set(`cache:${key}`, JSON.stringify(value), "PX", ttl);
      } catch {
        /* cache is best-effort */
      }
    },
    async del(key: string) {
      try {
        const c = await client();
        await c.del(`cache:${key}`);
      } catch {
        /* ignore */
      }
      inflight.delete(key);
    },
    async getOrSet<T>(key: string, factory: () => Promise<T>, opts: CacheSetOptions) {
      const hit = await this.get<T>(key);
      if (hit != null) return hit;
      const existing = inflight.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const pending = factory()
        .then(async (value) => {
          await this.set(key, value, opts);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
      return pending;
    },
  };
}
