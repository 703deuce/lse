import { NextResponse } from "next/server";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

export async function POST(request: Request) {
  try {
    await requireRecentAuth();
    const auth = await requireOrganizationPermission("org.delete");
    const supabase = createServiceClient();

    const { data: org, error } = await supabase
      .from("organizations")
      .update({
        status: "deleted",
        outbound_paused: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.organizationId)
      .neq("status", "deleted")
      .select("id, name")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!org) {
      return NextResponse.json({ error: "Organization not found or already deleted" }, { status: 404 });
    }

    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "org.delete_requested",
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization",
      resourceId: org.id,
      meta: { name: org.name },
      ...meta,
    });

    return NextResponse.json({
      ok: true,
      organizationId: org.id,
      status: "deleted",
      message:
        "Organization marked for deletion. Outbound messaging is paused; data retention cleanup runs on schedule.",
    });
  } catch (err) {
    return httpErrorFromException(err, "Organization deletion could not be completed");
  }
}
