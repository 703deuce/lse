import { NextResponse } from "next/server";
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
    const message = err instanceof Error ? err.message : "Failed to load backlink gap data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
