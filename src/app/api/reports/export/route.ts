import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { generateReport } from "@/lib/reporting/generate-report";
import { exportReportSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = exportReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    await requireBusinessAccess(parsed.data.businessId);
    const report = await generateReport(parsed.data);

    return NextResponse.json({
      reportId: report.reportId,
      shareToken: report.shareToken,
      shareUrl: `/reports/share/${report.shareToken}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
