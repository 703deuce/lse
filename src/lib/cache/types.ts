export type CacheDriverName = "none" | "memory" | "redis";

export type CacheGetOptions = {
  /** Soft TTL for stale-while-revalidate (ms). */
  staleMs?: number;
};

export type CacheSetOptions = {
  ttlMs: number;
  /** Random jitter fraction 0–1 applied to ttl (default 0.1). */
  jitterRatio?: number;
};

export interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, opts: CacheSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  /** Single-flight regenerate: only one caller rebuilds on miss. */
  getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    opts: CacheSetOptions
  ): Promise<T>;
}
