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
import { exportReportSchema } from "@/lib/validation/schemas";

function exportStatus(message: string): number {
  if (message.includes("access denied") || message.includes("Authentication required")) {
    return 403;
  }
  if (
    message.includes("required") ||
    message.includes("at least 2") ||
    message.includes("at least two") ||
    message.includes("No review momentum") ||
    message.includes("Add a keyword") ||
    message.includes("not implemented") ||
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

    const persist = data.format !== "csv";
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
      persist,
    });

    if (data.format === "csv") {
      let csv = "";
      const payload = result.payload;
      if (payload.reportType === "single_scan") csv = singleScanToCsv(payload);
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
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${reportType}-report.csv"`,
        },
      });
    }

    return NextResponse.json({
      reportId: result.reportId,
      shareToken: result.shareToken,
      shareUrl: `/reports/share/${result.shareToken}`,
      reportType: result.payload.reportType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: exportStatus(message) });
  }
}
