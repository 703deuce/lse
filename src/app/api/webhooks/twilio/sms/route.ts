import { NextResponse } from "next/server";
import { handleTwilioSmsReply } from "@/lib/reputation/review-sends";
import { addSuppression } from "@/lib/reputation/bulk-validate";
import { clearSmsSuppression } from "@/lib/reputation/contacts";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import { isSmsOptInMessage, isSmsOptOutMessage } from "@/lib/reputation/phone";
import { createServiceClient } from "@/lib/db/client";
import {
  getTwilioWebhookAuthToken,
  verifyTwilioRequestSignature,
} from "@/lib/reputation/twilio";
import { logger } from "@/lib/observability/logger";
import { getTwilioSmsWebhookUrl } from "@/lib/app-url";
import { applyProviderDeliveryStatus } from "@/lib/reputation/delivery-status";
import { pickLatestSmsBusiness } from "@/lib/reputation/reply-match";

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
  // Prefer configured public URL (Coolify/proxies may rewrite request.url).
  const url = getTwilioSmsWebhookUrl() || request.url;

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
    const messageSid = formParams.MessageSid ?? formParams.SmsSid ?? "";
    const messageStatus = formParams.MessageStatus ?? formParams.SmsStatus ?? "";

    // Delivery status callbacks (no inbound SMS body).
    if (messageSid && messageStatus && !body) {
      await applyProviderDeliveryStatus({
        providerMessageId: messageSid,
        status: messageStatus,
        errorCode: formParams.ErrorCode ?? null,
      });
      return twilioXml();
    }

    if (!from) {
      return new NextResponse("<Response></Response>", {
        status: 400,
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (isSmsOptOutMessage(body) || isSmsOptInMessage(body)) {
      // Do not treat STOP/START as a normal reply (avoids setting replied_at).
      await handleTwilioSmsReply({
        from,
        body,
        messageSid,
        skipCampaignReplyState: true,
      });
      const phone = normalizePhoneE164(from);
      if (phone) {
        const supabase = createServiceClient();
        const candidates: Array<{
          businessId: string;
          organizationId: string;
          at: string;
        }> = [];

        const { data: recentSend } = await supabase
          .from("review_request_sends")
          .select("business_id, organization_id, sent_at, created_at")
          .eq("recipient_phone", phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentSend) {
          candidates.push({
            businessId: recentSend.business_id as string,
            organizationId: recentSend.organization_id as string,
            at: String(recentSend.sent_at ?? recentSend.created_at),
          });
        }

        const { data: campaignRecipients } = await supabase
          .from("review_request_recipients")
          .select("id, business_id, organization_id, created_at")
          .eq("phone", phone)
          .order("created_at", { ascending: false })
          .limit(10);

        for (const recip of campaignRecipients ?? []) {
          const { data: lastMsg } = await supabase
            .from("review_request_messages")
            .select("sent_at, created_at")
            .eq("recipient_id", recip.id)
            .eq("channel", "sms")
            .in("status", ["sent", "delivered", "clicked"])
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          candidates.push({
            businessId: recip.business_id as string,
            organizationId: recip.organization_id as string,
            at: String(lastMsg?.sent_at ?? lastMsg?.created_at ?? recip.created_at),
          });
        }

        // Shared Twilio number: only mute/unmute the business that last messaged this phone.
        const target = pickLatestSmsBusiness(candidates);
        if (target && isSmsOptOutMessage(body)) {
          await addSuppression({
            organizationId: target.organizationId,
            businessId: target.businessId,
            phone,
            reason: "sms_stop",
          });
          for (const recip of campaignRecipients ?? []) {
            if (recip.business_id !== target.businessId) continue;
            await supabase
              .from("review_request_messages")
              .update({ status: "opted_out", updated_at: new Date().toISOString() })
              .eq("recipient_id", recip.id)
              .in("status", ["queued", "sending"]);
            await supabase
              .from("review_request_recipients")
              .update({
                workflow_status: "opted_out",
                updated_at: new Date().toISOString(),
              })
              .eq("id", recip.id);
          }
          await supabase
            .from("review_request_contacts")
            .update({ sms_opt_out: true, updated_at: new Date().toISOString() })
            .eq("business_id", target.businessId)
            .eq("phone_e164", phone);
        } else if (target && isSmsOptInMessage(body)) {
          await clearSmsSuppression({
            organizationId: target.organizationId,
            businessId: target.businessId,
            phone,
          });
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
