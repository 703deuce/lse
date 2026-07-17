import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createCitationTasksFromAudit, loadLatestCitationAudit } from "@/lib/citations/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId } = body as { businessId?: string };
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const latest = await loadLatestCitationAudit(businessId);
    if (!latest?.audit) {
      return NextResponse.json({ error: "No citation audit found — run an audit first" }, { status: 400 });
    }

    const tasks = await createCitationTasksFromAudit(
      latest.audit.id as string,
      businessId,
      auth.organizationId
    );

    return NextResponse.json({ created: tasks.length, tasks });
  } catch (err) {
    return httpErrorFromException(err, "Failed to create tasks");
  }
}
