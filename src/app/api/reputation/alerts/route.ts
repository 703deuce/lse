import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessId = body.businessId as string | undefined;
    const alertId = body.alertId as string | undefined;
    if (!businessId || !alertId) {
      return NextResponse.json({ error: "businessId and alertId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);

    if (String(body.source ?? "").toLowerCase() === "synthesized") {
      return NextResponse.json({ ok: true, persisted: false });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("reputation_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId)
      .eq("business_id", businessId);

    if (error) {
      if (/relation .*reputation_alerts|schema cache|does not exist/i.test(error.message)) {
        return NextResponse.json({ ok: true, persisted: false });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    return httpErrorFromException(err, "Failed to resolve alert");
  }
}
