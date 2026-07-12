import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scanBatchId, businessId } = body as { scanBatchId?: string; businessId?: string };

    const supabase = createServiceClient();
    let targetScanId = scanBatchId;

    if (!targetScanId && businessId) {
      await requireBusinessAccess(businessId);
      const { data: latest } = await supabase
        .from("scan_batches")
        .select("id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetScanId = latest?.id;
    } else if (targetScanId) {
      const { data: batch } = await supabase.from("scan_batches").select("business_id").eq("id", targetScanId).single();
      if (batch) await requireBusinessAccess(batch.business_id);
    }

    if (!targetScanId) {
      return NextResponse.json({ error: "scanBatchId or businessId required" }, { status: 400 });
    }

    const { data: batch } = await supabase.from("scan_batches").select("business_id").eq("id", targetScanId).single();
    const { data: biz } = batch
      ? await supabase.from("businesses").select("organization_id").eq("id", batch.business_id).single()
      : { data: null };

    await processScanBatch(targetScanId, biz?.organization_id);

    const { data: audit } = await supabase.from("audits").select("*").eq("scan_batch_id", targetScanId).maybeSingle();
    return NextResponse.json({ audit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
