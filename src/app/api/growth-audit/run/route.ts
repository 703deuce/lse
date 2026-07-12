import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runGrowthAudit } from "@/lib/growth-audit/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keyword, skipBackground } = body as {
      businessId?: string;
      keyword?: string;
      skipBackground?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await runGrowthAudit({
      businessId,
      organizationId: auth.organizationId,
      keyword,
      skipBackground,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Growth audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
