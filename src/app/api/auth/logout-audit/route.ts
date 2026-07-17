import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "logout_all",
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      ...meta,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
