import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import {
  competitorsToCsv,
  locationToCsv,
  singleScanToCsv,
  trendToCsv,
} from "@/lib/reporting/csv";
import { exportReportSchema } from "@/lib/validation/schemas";

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

    const result = await generateTypedReport({
      businessId: data.businessId,
      scanBatchId: data.scanBatchId,
      reportType,
      keywordId: data.keywordId,
      locationId: data.locationId,
      gridSize: data.gridSize,
      radiusMeters: data.radiusMeters,
      selectedCompetitorKeys: data.selectedCompetitorKeys,
    });

    if (data.format === "csv") {
      let csv = "";
      const payload = result.payload;
      if (payload.reportType === "single_scan") csv = singleScanToCsv(payload);
      else if (payload.reportType === "trend") csv = trendToCsv(payload);
      else if (payload.reportType === "competitor") csv = competitorsToCsv(payload);
      else if (payload.reportType === "location") csv = locationToCsv(payload);
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
    const status =
      message.includes("access denied") || message.includes("not found")
        ? 403
        : message.includes("required") || message.includes("at least two")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
