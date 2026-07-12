import { NextResponse } from "next/server";
import { handleTwilioSmsReply } from "@/lib/reputation/review-sends";
import { addSuppression } from "@/lib/reputation/bulk-validate";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import { isSmsOptInMessage, isSmsOptOutMessage } from "@/lib/reputation/phone";
import { createServiceClient } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const from = String(form.get("From") ?? "");
    const body = String(form.get("Body") ?? "");
    const messageSid = String(form.get("MessageSid") ?? "");

    if (!from) {
      return new NextResponse("<Response></Response>", {
        status: 400,
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (isSmsOptOutMessage(body) || isSmsOptInMessage(body)) {
      await handleTwilioSmsReply({ from, body, messageSid });
      if (isSmsOptOutMessage(body)) {
        const phone = normalizePhoneE164(from);
        if (phone) {
          const supabase = createServiceClient();
          const { data: recentSend } = await supabase
            .from("review_request_sends")
            .select("business_id, organization_id")
            .eq("recipient_phone", phone)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recentSend) {
            await addSuppression({
              organizationId: recentSend.organization_id,
              businessId: recentSend.business_id,
              phone,
              reason: "sms_stop",
            });
          }
        }
      }
      const reply = isSmsOptOutMessage(body)
        ? "You have been unsubscribed from review request messages."
        : "You have been resubscribed to review request messages.";
      return new NextResponse(`<Response><Message>${reply}</Message></Response>`, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    await handleTwilioSmsReply({ from, body, messageSid });

    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio/sms webhook]", err);
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
