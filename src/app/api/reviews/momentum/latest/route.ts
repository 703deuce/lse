import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const data = await loadLatestMomentumRun(businessId);
    if (!data) {
      return NextResponse.json({ run: null, entities: [], tasks: [] });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load momentum report";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
