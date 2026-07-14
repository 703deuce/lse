import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runLocalTrustFinder } from "@/lib/local-trust/engine";
import { PlanLimitError, reserveUsageOrThrow } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, city, state, county, rescan } = body as {
      businessId?: string;
      city?: string;
      state?: string;
      county?: string;
      rescan?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await reserveUsageOrThrow(auth.organizationId, "local_trust_scans_used", 1);
    const result = await runLocalTrustFinder({
      businessId,
      organizationId: auth.organizationId,
      city,
      state,
      county,
      rescan,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Local trust finder failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
