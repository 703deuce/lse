import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";
import { revokeReportSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = revokeReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { businessId, reportId } = parsed.data;
    const access = await requireBusinessAccess(businessId);
    const auth = await requireOrganizationPermission("report.share", access.organizationId);
    const supabase = createServiceClient();

    // Keep HTML + metadata for audit; only kill public access.
    const { data, error } = await supabase
      .from("reports")
      .update({
        share_token: null,
        share_token_hash: null,
        share_password_hash: null,
        share_expires_at: new Date().toISOString(),
        share_view_count: 0,
        share_last_viewed_at: null,
        publish_status: "archived",
      })
      .eq("id", reportId)
      .eq("business_id", businessId)
      .select("id")
      .maybeSingle();

    if (error) {
      return httpErrorFromException(error, "Revoke failed");
    }
    if (!data) {
      return NextResponse.json({ error: "Report not found or access denied" }, { status: 404 });
    }

    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "report.share.revoke",
      organizationId: access.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "report",
      resourceId: data.id,
      ...meta,
    });

    return NextResponse.json({ ok: true, reportId: data.id });
  } catch (err) {
    return httpErrorFromException(err, "Revoke failed");
  }
}
