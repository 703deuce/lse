import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { scanProgressMessage } from "@/lib/scans/status";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
    if (!batch) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const conf = (batch.confidence_summary ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      status: batch.status,
      rank_status: batch.rank_status,
      enrichment_status: batch.enrichment_status,
      cells_completed: batch.cells_completed ?? conf.completed_cells ?? 0,
      cells_total: batch.cells_total ?? conf.total_cells ?? 0,
      cells_failed: batch.cells_failed ?? conf.failed_cells ?? 0,
      rank_ready_at: batch.rank_ready_at,
      enrichment_started_at: batch.enrichment_started_at,
      enrichment_finished_at: batch.enrichment_finished_at,
      ready_at: batch.ready_at,
      message: scanProgressMessage({
        status: batch.status,
        enrichment_status: batch.enrichment_status,
        cells_completed: batch.cells_completed,
        cells_total: batch.cells_total,
        cells_failed: batch.cells_failed,
        confidence_summary: conf,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Progress fetch failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
