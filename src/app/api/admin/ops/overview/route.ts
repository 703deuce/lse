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

    const [counts, redis] = await Promise.all([countJobsByStatus(), pingRedis()]);
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
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load ops overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
