import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
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
      return NextResponse.json({ run: null });
    }

    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        growthScore: run.growth_score,
        sections: run.sections_json,
        growthPlan: run.growth_plan_json,
        extended: run.extended_json,
        progressStage: run.progress_stage,
        errorMessage: run.error_message,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load audit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
