import type { createServiceClient } from "@/lib/db/client";

type ServiceClient = ReturnType<typeof createServiceClient>;

export const WORKSPACE_CACHE_TYPES = {
  ENTITY_GRID: "entity_grid",
  FINGERPRINT: "fingerprint",
  CELL_WHY: "cell_why",
  COMPARE: "compare",
} as const;

export type WorkspaceCacheType = (typeof WORKSPACE_CACHE_TYPES)[keyof typeof WORKSPACE_CACHE_TYPES];

export function entityGridCacheKey(keywordId: string, entityKey: string): string {
  return `${keywordId}:${entityKey}`;
}

export function fingerprintCacheKey(
  keywordId: string,
  entityKey: string,
  competitorId: string | null
): string {
  return `${keywordId}:${entityKey}:${competitorId ?? "none"}`;
}

export function cellWhyCacheKey(keywordId: string, cellId: string, entityKey: string): string {
  return `${keywordId}:${cellId}:${entityKey}`;
}

export function compareCacheKey(
  scanBId: string,
  keywordIdA: string | null,
  keywordIdB: string | null,
  mode: string,
  entityAKey: string,
  entityBKey: string
): string {
  return `${scanBId}:${keywordIdA ?? ""}:${keywordIdB ?? ""}:${mode}:${entityAKey}:${entityBKey}`;
}

export async function getWorkspaceCache<T>(
  supabase: ServiceClient,
  scanBatchId: string,
  cacheType: WorkspaceCacheType,
  cacheKey: string
): Promise<T | null> {
  const { data } = await supabase
    .from("scan_workspace_cache")
    .select("payload")
    .eq("scan_batch_id", scanBatchId)
    .eq("cache_type", cacheType)
    .eq("cache_key", cacheKey)
    .maybeSingle();

  return (data?.payload as T | undefined) ?? null;
}

export async function setWorkspaceCache(
  supabase: ServiceClient,
  scanBatchId: string,
  cacheType: WorkspaceCacheType,
  cacheKey: string,
  payload: unknown
): Promise<void> {
  await supabase.from("scan_workspace_cache").upsert(
    {
      scan_batch_id: scanBatchId,
      cache_type: cacheType,
      cache_key: cacheKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "scan_batch_id,cache_type,cache_key" }
  );
}

export async function setWorkspaceCacheBatch(
  supabase: ServiceClient,
  rows: Array<{
    scanBatchId: string;
    cacheType: WorkspaceCacheType;
    cacheKey: string;
    payload: unknown;
  }>
): Promise<void> {
  if (!rows.length) return;
  const now = new Date().toISOString();
  await supabase.from("scan_workspace_cache").upsert(
    rows.map((row) => ({
      scan_batch_id: row.scanBatchId,
      cache_type: row.cacheType,
      cache_key: row.cacheKey,
      payload: row.payload,
      updated_at: now,
    })),
    { onConflict: "scan_batch_id,cache_type,cache_key" }
  );
}
