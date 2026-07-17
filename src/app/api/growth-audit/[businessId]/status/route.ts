import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestGrowthAuditStatus } from "@/lib/growth-audit/engine";

/**
 * Compact growth-audit status for adaptive polling.
 * Must not load sections_json or other heavy audit payloads.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const run = await loadLatestGrowthAuditStatus(businessId);
    if (!run) {
      return NextResponse.json({ status: "none" });
    }

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      progressStage: run.progress_stage,
      extended: run.extended_json ?? {},
      finishedAt: run.finished_at,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load status");
  }
}
