import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { loadLatestGrowthAudit } from "@/lib/growth-audit/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const run = await loadLatestGrowthAudit(businessId);
    if (!run) {
      return NextResponse.json({ status: "none" });
    }

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      progressStage: run.progress_stage,
      extended: run.extended_json,
      finishedAt: run.finished_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load status";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
