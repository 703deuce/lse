import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { countJobsByStatus } from "@/lib/queue/ledger";
import {
  brightDataMaxInFlight,
  getQueueDriverName,
  getRedisUrl,
} from "@/lib/queue/config";
import { getCacheDriverName } from "@/lib/cache/config";
import { getLockDriverName } from "@/lib/locks";
import { providerHealth } from "@/lib/providers/gateway";
import { dbLimiterStats } from "@/lib/platform/db-limiter";
import { createServiceClient } from "@/lib/db/client";

async function loadWebhookOpsMetrics() {
  const supabase = createServiceClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();

  const [
    { count: activeEndpoints },
    { count: events24h },
    { count: eventsMonth },
    { count: failed24h },
    { count: needsReview },
    { count: queued },
  ] = await Promise.all([
    supabase
      .from("integration_webhook_endpoints")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .is("revoked_at", null),
    supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .gte("received_at", dayAgo),
    supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .gte("received_at", monthIso),
    supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed_retryable", "failed_permanent", "rejected_invalid", "rejected_unauthorized"])
      .gte("received_at", dayAgo),
    supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "needs_review"),
    supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "processing", "failed_retryable"]),
  ]);

  return {
    activeEndpoints: activeEndpoints ?? 0,
    events24h: events24h ?? 0,
    eventsMonth: eventsMonth ?? 0,
    failed24h: failed24h ?? 0,
    needsReview: needsReview ?? 0,
    backlog: queued ?? 0,
  };
}

async function pingRedis(): Promise<{ configured: boolean; ok: boolean; latencyMs?: number; error?: string }> {
  const url = getRedisUrl();
  if (!url) return { configured: false, ok: false };
  const started = Date.now();
  try {
    const IORedis = (await import("ioredis")).default;
    const redis = new IORedis(url, { maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 2000 });
    await redis.connect();
    const pong = await redis.ping();
    await redis.quit().catch(() => {});
    return { configured: true, ok: pong === "PONG", latencyMs: Date.now() - started };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const [counts, redis, webhooks] = await Promise.all([
      countJobsByStatus(),
      pingRedis(),
      loadWebhookOpsMetrics(),
    ]);
    const providers = ["brightdata", "dataforseo", "scrapingdog", "deepseek", "twilio", "brevo"].map(
      (p) => providerHealth(p)
    );

    return NextResponse.json({
      drivers: {
        queue: getQueueDriverName(),
        cache: getCacheDriverName(),
        lock: getLockDriverName(),
      },
      redis,
      brightData: {
        maxInFlight: brightDataMaxInFlight(),
      },
      dbLimiter: dbLimiterStats(),
      jobCounts: counts,
      providers,
      webhooks,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ops overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
