import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getBacklinkGapAnalytics } from "@/lib/backlink-gap/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const stats = await getBacklinkGapAnalytics(businessId);
    return NextResponse.json(stats ?? {});
  } catch (err) {
    return httpErrorFromException(err, "Failed to load stats");
  }
}
