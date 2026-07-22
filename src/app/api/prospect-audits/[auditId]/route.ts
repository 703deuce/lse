import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { attachProspectAuditJobs } from "@/lib/prospect-audit/run";
import { buildProspectAuditReport } from "@/lib/prospect-audit/build-report";
import { markProspectAuditSent } from "@/lib/accounts/mark-audit-sent";

const patchSchema = z.object({
  scanBatchIds: z.array(z.string().uuid()).max(3).optional(),
  growthAuditRunId: z.string().uuid().nullable().optional(),
  status: z.enum(["running", "ready", "failed", "shared"]).optional(),
  errorMessage: z.string().max(2000).nullable().optional(),
  markShared: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditId: string }> }
) {
  try {
    const { auditId } = await params;
    const supabase = createServiceClient();
    const { data: row, error } = await supabase
      .from("prospect_audits")
      .select("id, business_id")
      .eq("id", auditId)
      .maybeSingle();
    if (error && /prospect_audits|does not exist/i.test(error.message)) {
      return NextResponse.json({ error: "Prospect audits not migrated yet" }, { status: 503 });
    }
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireBusinessAccess(row.business_id as string);
    const report = await buildProspectAuditReport(row.business_id as string, {
      auditId,
    });
    return NextResponse.json({ report });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load prospect audit");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> }
) {
  try {
    const { auditId } = await params;
    if (auditId.startsWith("ephemeral-")) {
      return NextResponse.json({ ok: true, ephemeral: true });
    }
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const supabase = createServiceClient();
    const { data: row } = await supabase
      .from("prospect_audits")
      .select("id, business_id")
      .eq("id", auditId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireBusinessAccess(row.business_id as string);

    await attachProspectAuditJobs({
      auditId,
      scanBatchIds: parsed.data.scanBatchIds,
      growthAuditRunId: parsed.data.growthAuditRunId,
      status: parsed.data.status,
      errorMessage: parsed.data.errorMessage,
    });

    if (parsed.data.markShared || parsed.data.status === "shared") {
      await supabase
        .from("prospect_audits")
        .update({
          status: "shared",
          shared_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", auditId);
      await markProspectAuditSent(supabase, row.business_id as string).catch(() => {});
    }

    const report = await buildProspectAuditReport(row.business_id as string, {
      auditId,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update prospect audit");
  }
}
