import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { assertScanBelongsToBusiness } from "@/lib/db/queries";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";

/**
 * Re-process / finalize audit for a scan via the queue — never runs Bright Data
 * inside the request handler.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scanBatchId, businessId } = body as { scanBatchId?: string; businessId?: string };

    const supabase = createServiceClient();
    let targetScanId = scanBatchId;
    let targetBusinessId = businessId;

    if (!targetScanId && businessId) {
      await requireBusinessAccess(businessId);
      const { data: latest } = await supabase
        .from("scan_batches")
        .select("id")
        .eq("business_id", businessId)
        .in("status", [...USABLE_SCAN_STATUSES])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetScanId = latest?.id;
      targetBusinessId = businessId;
    } else if (targetScanId) {
      const { data: batch } = await supabase
        .from("scan_batches")
        .select("business_id")
        .eq("id", targetScanId)
        .single();
      if (batch) {
        await requireBusinessAccess(batch.business_id);
        targetBusinessId = batch.business_id;
        if (businessId) await assertScanBelongsToBusiness(targetScanId, businessId);
      }
    }

    if (!targetScanId || !targetBusinessId) {
      return NextResponse.json({ error: "scanBatchId or businessId required" }, { status: 400 });
    }

    const { data: biz } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", targetBusinessId)
      .single();

    if (!biz?.organization_id) {
      return NextResponse.json({ error: "Business organization not found" }, { status: 404 });
    }

    const dispatched = await dispatchScanProcessing({
      scanBatchId: targetScanId,
      businessId: targetBusinessId,
      organizationId: biz.organization_id,
    });

    return NextResponse.json({
      queued: true,
      scanBatchId: targetScanId,
      jobId: dispatched.jobId,
      queueDriver: dispatched.driver,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
