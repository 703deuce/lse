import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { resolveReportSections } from "@/lib/reporting/report-sections";

const schema = z.object({
  businessId: z.string().uuid(),
  reportId: z.string().uuid(),
  sections: z.record(z.string(), z.boolean()),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { businessId, reportId, sections } = parsed.data;
    const access = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("report.create", access.organizationId);
    const supabase = createServiceClient();

    const { data: report } = await supabase
      .from("reports")
      .select("metadata_json")
      .eq("id", reportId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const resolved = resolveReportSections(sections);
    const meta = {
      ...((report.metadata_json as Record<string, unknown>) ?? {}),
      sections: resolved,
    };
    const { error } = await supabase
      .from("reports")
      .update({ metadata_json: meta })
      .eq("id", reportId)
      .eq("business_id", businessId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, sections: resolved });
  } catch (err) {
    return httpErrorFromException(err, "Failed to save sections");
  }
}
