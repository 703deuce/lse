import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runLocalTrustFinder } from "@/lib/local-trust/engine";

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
    const message = err instanceof Error ? err.message : "Local trust finder failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
