import { getCacheDriverName } from "@/lib/cache/config";
import {
  createMemoryCache,
  createNoneCache,
  createRedisCache,
} from "@/lib/cache/drivers";
import type { CacheDriver } from "@/lib/cache/types";

export { getCacheDriverName, cacheKey, tenantCacheKey } from "@/lib/cache/config";
export type { CacheDriver, CacheDriverName, CacheSetOptions } from "@/lib/cache/types";

let singleton: CacheDriver | null = null;

export function getCache(): CacheDriver {
  if (singleton) return singleton;
  const driver = getCacheDriverName();
  if (driver === "redis") singleton = createRedisCache();
  else if (driver === "memory") singleton = createMemoryCache();
  else singleton = createNoneCache();
  return singleton;
}

/** Test helper — reset singleton after env changes. */
export function resetCacheForTests(): void {
  singleton = null;
}
