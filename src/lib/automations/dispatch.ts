import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import type { VerifiedApiKey } from "@/lib/auth/api-keys";
import { createServiceClient } from "@/lib/db/client";
import {
  contactDisplayName,
  parseAutomationContact,
} from "@/lib/automations/contact-payload";
import { enrollContactInCampaign } from "@/lib/automations/enroll-campaign";
import { upsertBusinessContact } from "@/lib/reputation/contacts";
import { addSuppression } from "@/lib/reputation/bulk-validate";
import { setContactSuppression } from "@/lib/reputation/contacts";
import {
  sendReviewRequestEmail,
  sendReviewRequestSms,
} from "@/lib/reputation/review-sends";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import { normalizeEmail } from "@/lib/reputation/contacts-normalize";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";

export const AUTOMATION_ACTIONS = [
  "upsert_contact",
  "enroll_campaign",
  "send_review_request",
  "suppress_contact",
] as const;

export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export type DispatchResult = {
  ok: boolean;
  action: AutomationAction;
  status: number;
  data?: Record<string, unknown>;
  error?: string;
};

function resolveBusinessId(
  body: Record<string, unknown>,
  key: VerifiedApiKey
): string | null {
  const fromBody =
    (typeof body.businessId === "string" && body.businessId) ||
    (typeof body.business_id === "string" && body.business_id) ||
    null;
  if (key.businessId) {
    if (fromBody && fromBody !== key.businessId) {
      return null; // scoped key cannot target another business
    }
    return key.businessId;
  }
  return fromBody;
}

async function assertBusinessInOrg(businessId: string, organizationId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) throw new Error("Business not found or access denied");
}

export async function dispatchAutomationWebhook(params: {
  key: VerifiedApiKey;
  body: Record<string, unknown>;
}): Promise<DispatchResult> {
  const rawAction = String(params.body.action ?? params.body.type ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (!AUTOMATION_ACTIONS.includes(rawAction as AutomationAction)) {
    return {
      ok: false,
      action: (rawAction || "upsert_contact") as AutomationAction,
      status: 400,
      error: `Unknown action. Supported: ${AUTOMATION_ACTIONS.join(", ")}`,
    };
  }
  const action = rawAction as AutomationAction;

  if (!params.key.scopes.includes("automation") && params.key.scopes.length) {
    return { ok: false, action, status: 403, error: "API key missing automation scope" };
  }

  const businessId = resolveBusinessId(params.body, params.key);
  if (!businessId) {
    return {
      ok: false,
      action,
      status: 400,
      error: params.key.businessId
        ? "This API key is scoped to a different businessId"
        : "businessId is required",
    };
  }

  try {
    await assertBusinessInOrg(businessId, params.key.organizationId);
    await requireEntitlement(params.key.organizationId, "review_campaigns");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied";
    return {
      ok: false,
      action,
      status: err instanceof EntitlementError ? 403 : 403,
      error: message,
    };
  }

  const contact = parseAutomationContact(params.body);

  try {
    if (action === "upsert_contact") {
      if (!contact.phone && !contact.email) {
        return { ok: false, action, status: 400, error: "phone or email is required" };
      }
      const result = await upsertBusinessContact({
        organizationId: params.key.organizationId,
        businessId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        customerName: contactDisplayName(contact),
        phone: contact.phone,
        email: contact.email,
        notes: contact.notes,
        externalCustomerId: contact.externalId,
        lastServiceDate: contact.serviceDate,
        tags: contact.tags,
        source: "automation",
      });
      return {
        ok: true,
        action,
        status: 200,
        data: { contactId: result.id, created: result.created },
      };
    }

    if (action === "enroll_campaign") {
      const campaignId =
        (typeof params.body.campaignId === "string" && params.body.campaignId) ||
        (typeof params.body.campaign_id === "string" && params.body.campaign_id) ||
        null;
      if (!campaignId) {
        return { ok: false, action, status: 400, error: "campaignId is required" };
      }
      if (!contact.phone && !contact.email) {
        return { ok: false, action, status: 400, error: "phone or email is required" };
      }
      const delayMinutes = Number(
        params.body.delayMinutes ?? params.body.delay_minutes ?? 0
      );
      const result = await enrollContactInCampaign({
        organizationId: params.key.organizationId,
        businessId,
        campaignId,
        contact,
        delayMinutes: Number.isFinite(delayMinutes) ? delayMinutes : 0,
      });
      return {
        ok: true,
        action,
        status: 200,
        data: { ...result },
      };
    }

    if (action === "send_review_request") {
      const channelRaw = String(params.body.channel ?? "auto").toLowerCase();
      let channel: "sms" | "email";
      if (channelRaw === "sms" || channelRaw === "text") channel = "sms";
      else if (channelRaw === "email") channel = "email";
      else if (contact.phone) channel = "sms";
      else if (contact.email) channel = "email";
      else {
        return {
          ok: false,
          action,
          status: 400,
          error: "phone or email required (or set channel)",
        };
      }

      const name = contactDisplayName(contact);
      if (channel === "sms") {
        if (!contact.phone) {
          return { ok: false, action, status: 400, error: "phone is required for SMS" };
        }
        await reserveUsageOrThrow(params.key.organizationId, "review_sms_sent", 1);
        try {
          const result = await sendReviewRequestSms({
            businessId,
            organizationId: params.key.organizationId,
            customerName: name,
            customerPhone: contact.phone,
            serviceType: contact.jobType ?? undefined,
          });
          if (!result.ok) {
            await releaseUsage(params.key.organizationId, "review_sms_sent", 1).catch(() => undefined);
            return { ok: false, action, status: 502, error: result.error, data: { sendId: result.sendId } };
          }
          return {
            ok: true,
            action,
            status: 200,
            data: {
              channel: "sms",
              sendId: result.sendId,
              messageSid: result.messageSid,
            },
          };
        } catch (err) {
          await releaseUsage(params.key.organizationId, "review_sms_sent", 1).catch(() => undefined);
          throw err;
        }
      }

      if (!contact.email) {
        return { ok: false, action, status: 400, error: "email is required for email" };
      }
      await reserveUsageOrThrow(params.key.organizationId, "review_emails_sent", 1);
      try {
        const result = await sendReviewRequestEmail({
          businessId,
          organizationId: params.key.organizationId,
          customerName: name,
          customerEmail: contact.email,
          serviceType: contact.jobType ?? undefined,
        });
        if (!result.ok) {
          await releaseUsage(params.key.organizationId, "review_emails_sent", 1).catch(() => undefined);
          return { ok: false, action, status: 502, error: result.error, data: { sendId: result.sendId } };
        }
        return {
          ok: true,
          action,
          status: 200,
          data: {
            channel: "email",
            sendId: result.sendId,
            messageId: result.messageId,
          },
        };
      } catch (err) {
        await releaseUsage(params.key.organizationId, "review_emails_sent", 1).catch(() => undefined);
        throw err;
      }
    }

    if (action === "suppress_contact") {
      const phone = contact.phone ? normalizePhoneE164(contact.phone) : null;
      const email = contact.email ? normalizeEmail(contact.email) : null;
      if (!phone && !email) {
        return { ok: false, action, status: 400, error: "phone or email is required" };
      }
      await addSuppression({
        organizationId: params.key.organizationId,
        businessId,
        phone,
        email,
        reason: "automation_suppress",
      });

      // Best-effort contact flag update when a matching contact exists.
      const supabase = createServiceClient();
      let contactId: string | null = null;
      if (phone) {
        const { data } = await supabase
          .from("review_request_contacts")
          .select("id")
          .eq("business_id", businessId)
          .eq("phone_e164", phone)
          .maybeSingle();
        contactId = (data?.id as string) ?? null;
      }
      if (!contactId && email) {
        const { data } = await supabase
          .from("review_request_contacts")
          .select("id")
          .eq("business_id", businessId)
          .eq("email_normalized", email)
          .maybeSingle();
        contactId = (data?.id as string) ?? null;
      }
      if (contactId) {
        await setContactSuppression({
          organizationId: params.key.organizationId,
          businessId,
          contactId,
          ...(phone ? { smsOptOut: true } : {}),
          ...(email ? { emailUnsubscribed: true } : {}),
        });
      }

      return {
        ok: true,
        action,
        status: 200,
        data: { suppressed: true, contactId },
      };
    }

    return { ok: false, action, status: 400, error: "Unhandled action" };
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return { ok: false, action, status: 402, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Automation failed";
    const status =
      message.includes("required") ||
      message.includes("not found") ||
      message.includes("opted out") ||
      message.includes("must be active")
        ? 400
        : 500;
    return { ok: false, action, status, error: message };
  }
}
