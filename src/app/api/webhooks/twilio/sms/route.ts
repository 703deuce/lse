import { NextResponse } from "next/server";
import { handleTwilioSmsReply } from "@/lib/reputation/review-sends";
import { addSuppression } from "@/lib/reputation/bulk-validate";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import { isSmsOptInMessage, isSmsOptOutMessage } from "@/lib/reputation/phone";
import { createServiceClient } from "@/lib/db/client";
import {
  getTwilioWebhookAuthToken,
  verifyTwilioRequestSignature,
} from "@/lib/reputation/twilio";
import { logger } from "@/lib/observability/logger";

function twilioXml(body = ""): NextResponse {
  return new NextResponse(body ? `<Response><Message>${body}</Message></Response>` : "<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function authorizeTwilioWebhook(request: Request, formParams: Record<string, string>): NextResponse | null {
  const authToken = getTwilioWebhookAuthToken();
  if (process.env.NODE_ENV === "production") {
    if (!authToken) {
      logger.error("twilio_webhook_misconfigured", {
        hint: "Set TWILIO_ACCOUNT_AUTH_TOKEN (Account Auth Token) for signature validation",
      });
      return new NextResponse("Webhook auth not configured", { status: 503 });
    }
  } else if (!authToken) {
    // Local/dev: allow unsigned when the account token is unset.
    return null;
  }

  const signature = request.headers.get("x-twilio-signature");
  // Prefer explicit public URL (proxies may rewrite request.url).
  const url = process.env.TWILIO_WEBHOOK_URL?.trim() || request.url;

  if (!verifyTwilioRequestSignature({ authToken, signature, url, formParams })) {
    logger.warn("twilio_webhook_invalid_signature");
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const formParams: Record<string, string> = {};
    form.forEach((value, key) => {
      formParams[key] = String(value);
    });

    const denied = authorizeTwilioWebhook(request, formParams);
    if (denied) return denied;

    const from = formParams.From ?? "";
    const body = formParams.Body ?? "";
    const messageSid = formParams.MessageSid ?? "";

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
      return twilioXml(reply);
    }

    await handleTwilioSmsReply({ from, body, messageSid });

    return twilioXml();
  } catch (err) {
    logger.error("twilio_sms_webhook_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return twilioXml();
  }
}
