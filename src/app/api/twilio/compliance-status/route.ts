import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";

/**
 * TrustHub status_callback for Secondary Customer Profiles / Trust Products.
 * Looks up the registration by bundle SID and enqueues the state machine.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown> = {};
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      form.forEach((value, key) => {
        payload[key] = typeof value === "string" ? value : String(value);
      });
    }

    const bundleSid = String(
      payload.BundleSid ?? payload.bundle_sid ?? payload.sid ?? ""
    ).trim();
    const status = String(payload.Status ?? payload.status ?? "").trim();
    console.info("[twilio/compliance-status]", { bundleSid: bundleSid || null, status: status || null });

    if (bundleSid.startsWith("BU")) {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("messaging_registrations")
        .select("business_id, organization_id, businesses(name)")
        .or(
          `twilio_customer_profile_sid.eq.${bundleSid},twilio_a2p_trust_product_sid.eq.${bundleSid}`
        )
        .maybeSingle();

      if (data?.business_id && data?.organization_id) {
        const businessName =
          (data as { businesses?: { name?: string } }).businesses?.name ?? "Business";
        await enqueueMessagingRegistrationAdvance({
          organizationId: String(data.organization_id),
          businessId: String(data.business_id),
          businessName,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn(
      "[twilio/compliance-status] error",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ ok: true });
  }
}
