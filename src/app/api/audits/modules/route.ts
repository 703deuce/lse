import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { idempotencyTimeBucket } from "@/lib/queue/idempotency";
import { getLatestModuleAudit } from "@/lib/audit/run-audit";
import { executeAuditModule, isAuditModule } from "@/lib/audit/run-module";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Queue a GBP audit module (or return the latest saved result via GET).
 * Escape hatch: `?sync=1` / body.sync for local debugging only.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, module, keyword, sync } = body as {
      businessId?: string;
      module?: string;
      keyword?: string;
      sync?: boolean;
    };

    if (!businessId || !module) {
      return NextResponse.json({ error: "businessId and module required" }, { status: 400 });
    }
    if (!isAuditModule(module)) {
      return NextResponse.json({ error: "Unknown module" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);

    if (sync === true && process.env.NODE_ENV !== "production") {
      const result = await executeAuditModule({ businessId, module, keyword });
      return NextResponse.json(result);
    }

    const job = await dispatchFeatureJob({
      jobType: "gbp_audit_module",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        module,
        keyword,
      },
      organizationId: auth.organizationId,
      businessId,
      relatedResourceId: `${businessId}:${module}`,
      idempotencyKey: `gbp-audit:${businessId}:${module}:${keyword ?? ""}:${idempotencyTimeBucket()}`,
      priority: "normal",
      maxAttempts: 2,
    });

    if (job.enqueueState === "enqueue_failed") {
      return NextResponse.json(
        { error: "Failed to queue audit module", jobId: job.jobId },
        { status: 503 }
      );
    }

    return NextResponse.json({
      queued: true,
      status: "queued",
      jobId: job.jobId,
      module,
      queueDriver: job.driver,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit module failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}

/** Latest saved module result (used after a queued job settles). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const module = url.searchParams.get("module");
    if (!businessId || !module) {
      return NextResponse.json({ error: "businessId and module required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const row = await getLatestModuleAudit(businessId, module);
    if (!row) return NextResponse.json({ error: "No audit result yet" }, { status: 404 });
    return NextResponse.json(row.result_json ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load audit";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
