import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createLocalTrustTasksFromRun } from "@/lib/local-trust/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, runId } = body as { businessId?: string; runId?: string };

    if (!businessId || !runId) {
      return NextResponse.json({ error: "businessId and runId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const count = await createLocalTrustTasksFromRun(runId, businessId, auth.organizationId);

    return NextResponse.json({ created: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
