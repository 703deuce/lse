import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import {
  competitorsToCsv,
  keywordToCsv,
  locationToCsv,
  mapsCampaignToCsv,
  reviewCampaignToCsv,
  reviewsToCsv,
  singleScanToCsv,
  trendToCsv,
} from "@/lib/reporting/csv";
import { singleScanPointsCsv, singleScanSummaryCsv } from "@/lib/reporting/scan-csv";
import { exportReportSchema } from "@/lib/validation/schemas";
import { createServiceClient } from "@/lib/db/client";

function exportStatus(message: string): number {
  if (message.includes("access denied") || message.includes("Authentication required")) {
    return 403;
  }
  if (
    message.includes("required") ||
    message.includes("at least 2") ||
    message.includes("at least two") ||
    message.includes("No review momentum") ||
    message.includes("No completed review momentum") ||
    message.includes("No completed scans") ||
    message.includes("Add a keyword") ||
    message.includes("not implemented") ||
    message.includes("does not belong") ||
    /not found/i.test(message)
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = exportReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const data = parsed.data;
    await requireBusinessAccess(data.businessId);

    const reportType = data.reportType ?? "single_scan";
    if (
      (reportType === "single_scan" || reportType === "competitor") &&
      !data.scanBatchId
    ) {
      return NextResponse.json(
        { error: "scanBatchId is required for this report type" },
        { status: 400 }
      );
    }
    if (reportType === "review_campaign" && !data.campaignId) {
      return NextResponse.json(
        { error: "campaignId is required for review campaign reports" },
        { status: 400 }
      );
    }

    const format = data.format ?? "share";

    // CSV variants stay synchronous.
    if (format === "csv" || format === "summary_csv" || format === "points_csv") {
      const result = await generateTypedReport({
        businessId: data.businessId,
        scanBatchId: data.scanBatchId,
        reportType,
        keywordId: data.keywordId,
        locationId: data.locationId,
        campaignId: data.campaignId,
        gridSize: data.gridSize,
        radiusMeters: data.radiusMeters,
        selectedCompetitorKeys: data.selectedCompetitorKeys,
        persist: false,
      });
      let csv = "";
      const payload = result.payload;
      if (format === "summary_csv") {
        if (payload.reportType !== "single_scan") {
          return NextResponse.json(
            { error: "Summary CSV is only available for single scan reports" },
            { status: 400 }
          );
        }
        csv = singleScanSummaryCsv(payload);
      } else if (format === "points_csv") {
        if (payload.reportType !== "single_scan") {
          return NextResponse.json(
            { error: "Data points CSV is only available for single scan reports" },
            { status: 400 }
          );
        }
        csv = singleScanPointsCsv(payload);
      } else if (payload.reportType === "single_scan") csv = singleScanToCsv(payload);
      else if (payload.reportType === "trend") csv = trendToCsv(payload);
      else if (payload.reportType === "competitor") csv = competitorsToCsv(payload);
      else if (payload.reportType === "location") csv = locationToCsv(payload);
      else if (payload.reportType === "keyword") csv = keywordToCsv(payload);
      else if (payload.reportType === "maps_campaign") csv = mapsCampaignToCsv(payload);
      else if (payload.reportType === "reviews") csv = reviewsToCsv(payload);
      else if (payload.reportType === "review_campaign") csv = reviewCampaignToCsv(payload);
      else {
        return NextResponse.json({ error: "CSV not available for this report type" }, { status: 400 });
      }
      const filename =
        format === "summary_csv"
          ? "scan-summary.csv"
          : format === "points_csv"
            ? "scan-data-points.csv"
            : `${reportType}-report.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // HTML shareable reports: prefer reuse, then generate synchronously.
    // Async-only share previously crashed the Reports hub when the report worker
    // was slow/unavailable (endless poll → "This page couldn't load").
    if (reportType === "single_scan" && data.scanBatchId) {
      const supabase = createServiceClient();
      const identityKey = `single_scan:${data.scanBatchId}`;
      const { data: existing } = await supabase
        .from("reports")
        .select("id, share_token, share_expires_at")
        .eq("business_id", data.businessId)
        .eq("metadata_json->>reportType", "single_scan")
        .eq("metadata_json->>identityKey", identityKey)
        .not("share_token", "is", null)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const expiresAt = existing?.share_expires_at
        ? new Date(existing.share_expires_at as string).getTime()
        : 0;
      if (
        existing?.share_token &&
        expiresAt > Date.now() &&
        typeof existing.share_token === "string"
      ) {
        return NextResponse.json({
          queued: false,
          reused: true,
          reportId: existing.id,
          shareUrl: `/reports/share/${existing.share_token}`,
          reportType,
        });
      }
    }

    const result = await generateTypedReport({
      businessId: data.businessId,
      scanBatchId: data.scanBatchId,
      reportType,
      keywordId: data.keywordId,
      locationId: data.locationId,
      campaignId: data.campaignId,
      gridSize: data.gridSize,
      radiusMeters: data.radiusMeters,
      selectedCompetitorKeys: data.selectedCompetitorKeys,
      persist: true,
    });

    return NextResponse.json({
      queued: false,
      reportId: result.reportId,
      shareUrl: result.shareToken ? `/reports/share/${result.shareToken}` : null,
      reportType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: exportStatus(message) });
  }
}
