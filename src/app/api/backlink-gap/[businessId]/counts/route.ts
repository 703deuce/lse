import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getCompetitorGapCounts, getLatestBacklinkGapRunId } from "@/lib/backlink-gap/engine";
import { createServiceClient } from "@/lib/db/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "open") as "open" | "ignored";

    const runId = await getLatestBacklinkGapRunId(businessId);
    if (!runId) return NextResponse.json({ counts: [] });

    const supabase = createServiceClient();
    const { data: run } = await supabase
      .from("backlink_gap_runs")
      .select("selected_competitors")
      .eq("id", runId)
      .single();

    const competitors =
      (run?.selected_competitors as Array<{ name: string; domain?: string | null }>) ?? [];

    const counts = await getCompetitorGapCounts(businessId, competitors, status);
    return NextResponse.json({ counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load counts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
