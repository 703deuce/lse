import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
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
    const message = err instanceof Error ? err.message : "Failed to load stats";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
