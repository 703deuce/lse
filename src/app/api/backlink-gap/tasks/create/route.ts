import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { createBacklinkGapTasks } from "@/lib/backlink-gap/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, opportunityIds } = body as {
      businessId?: string;
      opportunityIds?: string[];
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const tasks = await createBacklinkGapTasks({
      businessId,
      organizationId: auth.organizationId,
      opportunityIds,
    });

    return NextResponse.json({ created: tasks.length, tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tasks";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
