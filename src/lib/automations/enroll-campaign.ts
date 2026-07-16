import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { validateBulkRecipients } from "@/lib/reputation/bulk-validate";
import {
  buildMessageSchedule,
  ymdInTimeZone,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { upsertBusinessContact } from "@/lib/reputation/contacts";
import { renderTemplate } from "@/lib/reputation/template-vars";
import { buildTrackingUrl, generateTrackingToken } from "@/lib/reputation/tracking";
import {
  defaultReviewRequestSequence,
  initialSendSteps,
  normalizeSequenceSteps,
  resolveWaveChannels,
  type SequenceStep,
} from "@/lib/reputation/sequence-engine";
import { releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import {
  contactDisplayName,
  type AutomationContactInput,
} from "@/lib/automations/contact-payload";

function defaultSmsBody(): string {
  return "Hi {{first_name}}, thanks for choosing {{business_name}}. Would you be willing to share your honest feedback on Google? {{review_link}} Reply STOP to opt out.";
}

function defaultEmailSubject(): string {
  return "How was your experience with {{business_name}}?";
}

function defaultEmailBody(): string {
  return `Hi {{first_name}},

Thanks for choosing {{business_name}}. We'd appreciate your honest feedback. If you have a minute, you can leave a Google review here:

{{review_link}}

Thank you.`;
}

async function loadTemplate(
  businessId: string,
  channel: "sms" | "email",
  templateId?: string | null
) {
  const supabase = createServiceClient();
  if (templateId) {
    const { data } = await supabase
      .from("review_request_templates")
      .select("*")
      .eq("id", templateId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase
    .from("review_request_templates")
    .select("*")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Upsert a contact and enroll them into an existing active/scheduled campaign.
 * Idempotent when the same phone/email is already a ready recipient on that campaign.
 */
export async function enrollContactInCampaign(params: {
  organizationId: string;
  businessId: string;
  campaignId: string;
  contact: AutomationContactInput;
  /** Minutes to delay first message relative to the normal schedule window. */
  delayMinutes?: number;
}): Promise<{
  contactId: string;
  recipientId: string;
  messageIds: string[];
  alreadyEnrolled: boolean;
  skipped?: boolean;
  skipReason?: string;
}> {
  const supabase = createServiceClient();
  const business = await getBusiness(params.businessId, params.organizationId);
  if (!business) throw new Error("Business not found");

  const { data: campaign } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("id", params.campaignId)
    .eq("business_id", params.businessId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found");
  if (!["active", "scheduled"].includes(String(campaign.status))) {
    throw new Error(`Campaign must be active or scheduled (currently ${campaign.status})`);
  }

  const { id: contactId } = await upsertBusinessContact({
    organizationId: params.organizationId,
    businessId: params.businessId,
    firstName: params.contact.firstName,
    lastName: params.contact.lastName,
    customerName: contactDisplayName(params.contact),
    phone: params.contact.phone,
    email: params.contact.email,
    notes: params.contact.notes,
    externalCustomerId: params.contact.externalId,
    lastServiceDate: params.contact.serviceDate,
    tags: params.contact.tags,
    source: "automation",
  });

  const { recipients: validated } = await validateBulkRecipients({
    businessId: params.businessId,
    rows: [
      {
        rowIndex: 0,
        first_name: params.contact.firstName ?? undefined,
        last_name: params.contact.lastName ?? undefined,
        full_name: contactDisplayName(params.contact),
        phone: params.contact.phone ?? undefined,
        email: params.contact.email ?? undefined,
        service_date: params.contact.serviceDate ?? undefined,
        job_type: params.contact.jobType ?? undefined,
        notes: params.contact.notes ?? undefined,
      },
    ],
    duplicateProtectionDays: Number(campaign.duplicate_protection_days ?? 90),
  });
  const row = validated[0]!;
  if (row.status !== "ready") {
    return {
      contactId,
      recipientId: "",
      messageIds: [],
      alreadyEnrolled: false,
      skipped: true,
      skipReason: row.skip_reason ?? row.status,
    };
  }

  const phone = row.normalized_phone ?? row.phone ?? null;
  const email = row.normalized_email ?? row.email ?? null;

  // Idempotency: already enrolled with open workflow.
  let existingQ = supabase
    .from("review_request_recipients")
    .select("id")
    .eq("campaign_id", params.campaignId)
    .eq("business_id", params.businessId)
    .in("workflow_status", ["pending", "scheduled", "in_progress", "waiting"]);
  if (phone) existingQ = existingQ.eq("phone", phone);
  else if (email) existingQ = existingQ.eq("email", email);
  else throw new Error("Contact requires a valid phone or email");

  const { data: existing } = await existingQ.limit(1).maybeSingle();
  if (existing) {
    return {
      contactId,
      recipientId: existing.id as string,
      messageIds: [],
      alreadyEnrolled: true,
    };
  }

  const sequence = normalizeSequenceSteps(
    (campaign.sequence_json as SequenceStep[] | null)?.length
      ? (campaign.sequence_json as SequenceStep[])
      : defaultReviewRequestSequence(campaign.channel as "sms" | "email" | "both")
  );
  const firstSends = initialSendSteps(sequence);
  const step = firstSends[0];
  const channels = step
    ? resolveWaveChannels({
        campaignChannel: campaign.channel as "sms" | "email" | "both",
        step,
        hasPhone: Boolean(phone),
        hasEmail: Boolean(email),
      })
    : ([
        ...(campaign.channel !== "email" && phone ? ["sms"] : []),
        ...(campaign.channel !== "sms" && email ? ["email"] : []),
      ] as Array<"sms" | "email">);

  if (!channels.length) {
    return {
      contactId,
      recipientId: "",
      messageIds: [],
      alreadyEnrolled: false,
      skipped: true,
      skipReason: "No matching channel for contact",
    };
  }

  const { data: link } = await supabase
    .from("review_request_links")
    .select("review_url")
    .eq("business_id", params.businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!link?.review_url) throw new Error("Generate a review link before enrolling contacts");

  await reserveUsageOrThrow(params.organizationId, "bulk_review_requests_used", 1);

  const now = new Date().toISOString();
  try {
    const { data: recipient, error: recipErr } = await supabase
      .from("review_request_recipients")
      .insert({
        organization_id: params.organizationId,
        business_id: params.businessId,
        campaign_id: params.campaignId,
        contact_id: contactId,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        full_name: row.full_name ?? contactDisplayName(params.contact),
        phone,
        email,
        service_date: row.service_date ?? null,
        job_type: row.job_type ?? null,
        notes: row.notes ?? null,
        status: "ready",
        workflow_status: "in_progress",
        current_step: 0,
        next_action_at: now,
      })
      .select("id, phone, email, first_name, last_name, full_name, job_type")
      .single();
    if (recipErr) throw new Error(recipErr.message);

    const tz = String(campaign.timezone || "America/New_York");
    const scheduleConfig: ScheduleConfig = {
      startDate: ymdInTimeZone(new Date(), tz),
      dailySendLimit: Number(campaign.daily_send_limit ?? 10),
      sendDays: (campaign.send_days as number[]) ?? [1, 2, 3, 4, 5],
      windowStart: String(campaign.send_window_start ?? "10:00"),
      windowEnd: String(campaign.send_window_end ?? "18:00"),
      timezone: tz,
    };

    const slots = buildMessageSchedule(
      channels.map((ch) => ({ recipientId: recipient.id as string, channel: ch })),
      scheduleConfig
    );

    const delayMs = Math.max(0, Number(params.delayMinutes ?? 0)) * 60_000;
    const smsTemplate = await loadTemplate(
      params.businessId,
      "sms",
      campaign.template_id as string | null
    );
    const emailTemplate = await loadTemplate(
      params.businessId,
      "email",
      campaign.template_id as string | null
    );

    const firstName =
      (recipient.first_name as string | null)?.trim() ||
      String(recipient.full_name ?? "there").split(/\s+/)[0] ||
      "there";

    const messageRows = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const token = generateTrackingToken();
      const trackingUrl = buildTrackingUrl(token);
      const vars = {
        first_name: firstName,
        full_name: (recipient.full_name as string | null) ?? firstName,
        customer_name: firstName,
        business_name: business.name,
        review_link: trackingUrl,
        service_type:
          (recipient.job_type as string | null) ?? params.contact.jobType ?? "recent service",
      };
      let subject: string | null = null;
      let body: string;
      if (slot.channel === "sms") {
        body = renderTemplate(smsTemplate?.body ?? defaultSmsBody(), vars);
      } else {
        subject = renderTemplate(emailTemplate?.subject ?? defaultEmailSubject(), vars);
        body = renderTemplate(emailTemplate?.body ?? defaultEmailBody(), vars);
      }
      const scheduledFor = new Date(slot.scheduledFor.getTime() + delayMs);
      const stepKey = step?.step_key ?? "initial";
      messageRows.push({
        organization_id: params.organizationId,
        business_id: params.businessId,
        campaign_id: params.campaignId,
        recipient_id: recipient.id,
        channel: slot.channel,
        status: "queued",
        tracking_token: token,
        tracking_url: trackingUrl,
        google_review_url: link.review_url,
        subject,
        message_body: body,
        scheduled_for: scheduledFor.toISOString(),
        step_key: stepKey,
        idempotency_key: `${params.campaignId}:${recipient.id}:${stepKey}:${slot.channel}`,
      });
    }

    const { data: insertedMsgs, error: msgErr } = await supabase
      .from("review_request_messages")
      .insert(messageRows)
      .select("id");
    if (msgErr) throw new Error(msgErr.message);

    const { data: contactRow } = await supabase
      .from("review_request_contacts")
      .select("campaign_attempts")
      .eq("id", contactId)
      .maybeSingle();
    await supabase
      .from("review_request_contacts")
      .update({
        campaign_attempts: Number(contactRow?.campaign_attempts ?? 0) + 1,
        last_contacted_at: now,
        updated_at: now,
      })
      .eq("id", contactId);

    return {
      contactId,
      recipientId: recipient.id as string,
      messageIds: (insertedMsgs ?? []).map((m) => m.id as string),
      alreadyEnrolled: false,
    };
  } catch (err) {
    await releaseUsage(params.organizationId, "bulk_review_requests_used", 1).catch(() => undefined);
    throw err;
  }
}
