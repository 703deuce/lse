import { NextResponse } from "next/server";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { cancelScanBatch } from "@/lib/scans/cancel-scan";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const access = await requireScanAccess(scanId);
    const result = await cancelScanBatch({
      scanBatchId: scanId,
      organizationId: access.organizationId,
      reason: "Canceled by user",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      scanId,
      cancelledJobs: result.cancelledJobs,
    });
  } catch (err) {
    return httpErrorFromException(err, "Cancel failed");
  }
}
