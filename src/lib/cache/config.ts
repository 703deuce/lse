import type { CacheDriverName } from "@/lib/cache/types";

export function getCacheDriverName(): CacheDriverName {
  const raw = (process.env.CACHE_DRIVER ?? "none").trim().toLowerCase();
  if (raw === "memory" || raw === "redis" || raw === "none") return raw;
  return "none";
}

export function cacheKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((p) => p != null && String(p).length > 0)
    .map((p) => String(p).replace(/:/g, "_"))
    .join(":");
}

/** Tenant-safe key helper. */
export function tenantCacheKey(
  organizationId: string,
  namespace: string,
  ...parts: Array<string | number | null | undefined>
): string {
  return cacheKey(["org", organizationId, namespace, ...parts]);
}
