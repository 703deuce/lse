import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/db/client";

/** How long a worker may hold an in-flight scan before another may reclaim it. */
export function scanLeaseTtlMs(): number {
  const n = Number(process.env.SCAN_LEASE_MS ?? 5 * 60 * 1000);
  return Number.isFinite(n) && n >= 30_000 ? n : 5 * 60 * 1000;
}

export function newScanLeaseOwner(): string {
  return `scan-worker-${randomUUID()}`;
}

function leaseExpiryIso(from = new Date()): string {
  return new Date(from.getTime() + scanLeaseTtlMs()).toISOString();
}

type ClaimedBatch = Record<string, unknown> & {
  id: string;
  status: string;
  business_id: string;
};

/** Claim a queued scan for first-time processing. */
export async function claimQueuedScan(
  scanBatchId: string,
  leaseOwner: string
): Promise<ClaimedBatch | null> {
  const supabase = createServiceClient();
  const now = new Date();
  const { data } = await supabase
    .from("scan_batches")
    .update({
      status: "dispatching",
      started_at: now.toISOString(),
      lease_owner: leaseOwner,
      lease_expires_at: leaseExpiryIso(now),
      heartbeat_at: now.toISOString(),
      error_message: null,
    })
    .eq("id", scanBatchId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  return (data as ClaimedBatch | null) ?? null;
}

/**
 * Reclaim a stuck dispatching/provider_running scan whose lease expired
 * (or never got a lease — e.g. pre-migration crash).
 */
export async function reclaimStaleScan(
  scanBatchId: string,
  leaseOwner: string
): Promise<ClaimedBatch | null> {
  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // Prefer rows with an expired lease.
  const { data: expired } = await supabase
    .from("scan_batches")
    .update({
      lease_owner: leaseOwner,
      lease_expires_at: leaseExpiryIso(now),
      heartbeat_at: nowIso,
      error_message: null,
    })
    .eq("id", scanBatchId)
    .in("status", ["dispatching", "provider_running"])
    .lt("lease_expires_at", nowIso)
    .select("*")
    .maybeSingle();

  if (expired) return expired as ClaimedBatch;

  // Pre-lease crashes: lease_expires_at NULL and stuck past TTL from started_at/updated_at.
  const staleBefore = new Date(now.getTime() - scanLeaseTtlMs()).toISOString();
  const { data: unleashed } = await supabase
    .from("scan_batches")
    .update({
      lease_owner: leaseOwner,
      lease_expires_at: leaseExpiryIso(now),
      heartbeat_at: nowIso,
      error_message: null,
    })
    .eq("id", scanBatchId)
    .in("status", ["dispatching", "provider_running"])
    .is("lease_expires_at", null)
    .or(`started_at.lt.${staleBefore},and(started_at.is.null,updated_at.lt.${staleBefore})`)
    .select("*")
    .maybeSingle();

  return (unleashed as ClaimedBatch | null) ?? null;
}

export async function extendScanLease(scanBatchId: string, leaseOwner: string): Promise<boolean> {
  const supabase = createServiceClient();
  const now = new Date();
  const { data } = await supabase
    .from("scan_batches")
    .update({
      lease_expires_at: leaseExpiryIso(now),
      heartbeat_at: now.toISOString(),
    })
    .eq("id", scanBatchId)
    .eq("lease_owner", leaseOwner)
    .in("status", ["dispatching", "provider_running", "normalizing"])
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function clearScanLease(scanBatchId: string, leaseOwner?: string): Promise<void> {
  const supabase = createServiceClient();
  let q = supabase
    .from("scan_batches")
    .update({
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", scanBatchId);
  if (leaseOwner) q = q.eq("lease_owner", leaseOwner);
  await q;
}

/** Find globally stale in-flight scans and return their ids (for cron reclaim). */
export async function listStaleInFlightScanIds(limit = 5): Promise<string[]> {
  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - scanLeaseTtlMs()).toISOString();

  const { data: expired } = await supabase
    .from("scan_batches")
    .select("id")
    .in("status", ["dispatching", "provider_running", "normalizing"])
    .lt("lease_expires_at", nowIso)
    .order("lease_expires_at", { ascending: true })
    .limit(limit);

  const ids = new Set((expired ?? []).map((r) => r.id as string));

  if (ids.size < limit) {
    const { data: unleashed } = await supabase
      .from("scan_batches")
      .select("id")
      .in("status", ["dispatching", "provider_running", "normalizing"])
      .is("lease_expires_at", null)
      .or(`started_at.lt.${staleBefore},and(started_at.is.null,updated_at.lt.${staleBefore})`)
      .limit(limit - ids.size);
    for (const r of unleashed ?? []) ids.add(r.id as string);
  }

  return [...ids];
}
