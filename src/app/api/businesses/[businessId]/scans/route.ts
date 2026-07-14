import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const { data: scans } = await supabase
      .from("scan_batches")
      .select("id, status, grid_size, radius_meters, created_at, finished_at, confidence_summary")
      .eq("business_id", businessId)
      .in("status", ["ready", "partial", "rank_ready", "enriching", "ai_planning"])
      .order("created_at", { ascending: false })
      .limit(50);

    const items = (scans ?? []).map((s) => {
      const confidence = (s.confidence_summary ?? {}) as { keyword_label?: string };
      return {
        id: s.id,
        status: s.status,
        grid_size: s.grid_size,
        radius_meters: s.radius_meters,
        created_at: s.created_at,
        finished_at: s.finished_at,
        keyword: confidence.keyword_label,
      };
    });

    return NextResponse.json({ scans: items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list scans";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
