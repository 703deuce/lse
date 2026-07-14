import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { runScanEnrichment } from "@/lib/jobs/run-scan-enrichment";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const access = await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: batch } = await supabase
      .from("scan_batches")
      .select("id, status, enrichment_status")
      .eq("id", scanId)
      .single();
    if (!batch) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    if (batch.status === "failed") {
      return NextResponse.json({ error: "Scan failed — rerun the grid scan first" }, { status: 400 });
    }

    if (batch.status === "ready" || batch.status === "partial") {
      return NextResponse.json({ ok: true, message: "Scan already fully enriched" });
    }

    if (!["rank_ready", "enriching", "scoring", "ai_planning"].includes(String(batch.status))) {
      return NextResponse.json({ error: "Scan is not rank-ready yet" }, { status: 400 });
    }

    if (batch.enrichment_status === "running") {
      return NextResponse.json({ ok: true, message: "Enrichment already running" });
    }

    // Claim happens inside runScanEnrichment — TOCTOU-safe vs parallel POSTs.
    void runScanEnrichment(scanId, access.organizationId)
      .then((result) => {
        if (!result.started) {
          console.log("[enrich] claim skipped (already running or not claimable)", scanId);
        }
      })
      .catch((err) => {
        console.error("[enrich] manual trigger failed", scanId, err);
      });

    return NextResponse.json({ ok: true, message: "Enrichment started" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment trigger failed";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
