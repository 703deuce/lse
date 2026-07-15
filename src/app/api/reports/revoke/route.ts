import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { revokeReportSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = revokeReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { businessId, reportId } = parsed.data;
    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("reports")
      .update({
        share_token: null,
        share_expires_at: new Date().toISOString(),
        html_content: null,
        metadata_json: {},
      })
      .eq("id", reportId)
      .eq("business_id", businessId)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Report not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, reportId: data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revoke failed";
    const status =
      message.includes("access denied") || message.includes("Authentication required")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
