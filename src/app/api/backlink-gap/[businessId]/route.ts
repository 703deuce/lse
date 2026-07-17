import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestBacklinkGapRun } from "@/lib/backlink-gap/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const data = await loadLatestBacklinkGapRun(businessId);
    if (!data) {
      return NextResponse.json({
        run: null,
        opportunities: [],
        tasks: [],
        matrix: [],
        competitors: [],
      });
    }
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load backlink gap data");
  }
}
