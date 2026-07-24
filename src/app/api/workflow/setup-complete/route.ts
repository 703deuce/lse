import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { markReputationSetupCompleted } from "@/lib/workflow/lifecycle";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { businessId?: string };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(body.businessId);
    await markReputationSetupCompleted(body.businessId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Failed to complete setup");
  }
}
