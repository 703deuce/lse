import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { scheduleScanProcessing } from "@/lib/jobs/schedule-scan";
import { requireScanAccess } from "@/lib/auth/api-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const access = await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: existing } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
    if (!existing) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const { data: batch, error } = await supabase
      .from("scan_batches")
      .insert({
        business_id: existing.business_id,
        status: "queued",
        scan_type: existing.scan_type,
        grid_size: existing.grid_size,
        radius_meters: existing.radius_meters,
        device: existing.device,
        os: existing.os,
        browser: (existing as { browser?: string }).browser ?? "chrome",
        provider: existing.provider,
      })
      .select("*")
      .single();

    if (error || !batch) {
      return NextResponse.json({ error: error?.message ?? "Rerun failed" }, { status: 500 });
    }

    scheduleScanProcessing(batch.id, access.organizationId);

    return NextResponse.json({ scan: batch });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rerun failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
