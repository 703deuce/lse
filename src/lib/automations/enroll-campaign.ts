import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { validateBulkRecipients } from "@/lib/reputation/bulk-validate";
import {
  buildMessageSchedule,
  ymdInTimeZone,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { upsertBusinessContact } from "@/lib/reputation/contacts";
import { buildTrackingUrl, generateTrackingToken } from "@/lib/reputation/tracking";
import { buildUnsubscribeUrl } from "@/lib/reputation/unsubscribe";
import {
  defaultReviewRequestSequence,
  initialSendSteps,
  normalizeSequenceSteps,
  resolveWaveChannels,
  sequenceStartsWithWait,
  waitDurationMs,
  type SequenceStep,
} from "@/lib/reputation/sequence-engine";
import {
  buildCampaignTemplateVars,
  renderStepMessage,
} from "@/lib/reputation/campaign-message-copy";
import { releaseUsage, reserveUsageOrThrow } from "@/lib/plans";
import {
  contactDisplayName,
  type AutomationContactInput,
} from "@/lib/automations/contact-payload";
import type { EnrollmentSource } from "@/lib/reputation/campaign-triggers";

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
    if (data && String(data.channel) === channel) return data;
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
 * Shared campaign enrollment engine.
 * Manual, CSV, webhook, API, and future Zapier/Make paths must call this.
 * Idempotent on open recipient match and on source_event_id when provided.
 */
export async function enrollContactInCampaign(params: {
  organizationId: string;
  businessId: string;
  campaignId: string;
  contact: AutomationContactInput;
  /** Prefer updating this contact id (webhook clear match). */
  preferredContactId?: string | null;
  /** Minutes to delay first message relative to the normal schedule window. */
  delayMinutes?: number;
  /** Override campaign duplicate_protection_days when set (e.g. webhook endpoint). */
  duplicateProtectionDays?: number;
  /** How this contact entered the campaign. */
  enrollmentSource?: EnrollmentSource;
  /** Webhook event id for idempotent retries. */
  sourceEventId?: string | null;
  /** Optional campaign run (manual launch wave). */
  campaignRunId?: string | null;
  /** When the source event occurred (defaults to now). */
  occurredAt?: string | Date | null;
  /** Allow enroll while campaign status is paused but enrollments not paused (manual add). */
  allowWhilePaused?: boolean;
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

  const status = String(campaign.status);
  const enrollmentsPaused = Boolean(campaign.enrollments_paused);
  if (enrollmentsPaused) {
    return {
      contactId: "",
      recipientId: "",
      messageIds: [],
      alreadyEnrolled: false,
      skipped: true,
      skipReason: "New enrollments paused for this campaign",
    };
  }

  const statusOk =
    ["active", "scheduled"].includes(status) ||
    (params.allowWhilePaused && status === "paused");
  if (!statusOk) {
    throw new Error(`Campaign must be active or scheduled (currently ${status})`);
  }

  // Idempotent: same webhook/API event must not enroll twice.
  if (params.sourceEventId) {
    const { data: byEvent } = await supabase
      .from("review_request_recipients")
      .select("id, contact_id")
      .eq("campaign_id", params.campaignId)
      .eq("source_event_id", params.sourceEventId)
      .maybeSingle();
    if (byEvent) {
      return {
        contactId: String(byEvent.contact_id ?? ""),
        recipientId: byEvent.id as string,
        messageIds: [],
        alreadyEnrolled: true,
      };
    }
  }

  const enrollmentSource: EnrollmentSource = params.enrollmentSource ?? "manual";
  const occurredAtIso = params.occurredAt
    ? new Date(params.occurredAt).toISOString()
    : new Date().toISOString();

  const { id: contactId } = await upsertBusinessContact({
    organizationId: params.organizationId,
    businessId: params.businessId,
    preferredContactId: params.preferredContactId,
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
    duplicateProtectionDays: Number(
      params.duplicateProtectionDays ?? campaign.duplicate_protection_days ?? 90
    ),
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
  const startsWithWait = sequenceStartsWithWait(sequence);
  const campaignChannel = campaign.channel as "sms" | "email" | "both";
  // For wait-first sequences, resolve against the first send step (not the wait).
  const firstSendStep =
    step ??
    sequence.find((s) => s.step_type === "send_sms" || s.step_type === "send_email") ??
    null;
  const channels = firstSendStep
    ? resolveWaveChannels({
        campaignChannel,
        step: firstSendStep,
        hasPhone: Boolean(phone),
        hasEmail: Boolean(email),
      })
    : ([
        ...(campaignChannel !== "email" && phone ? ["sms"] : []),
        ...(campaignChannel !== "sms" && email ? ["email"] : []),
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
  let recipientIdForRollback: string | null = null;
  try {
    const waitMs = startsWithWait
      ? waitDurationMs(sequence[0]!.config) + Math.max(0, Number(params.delayMinutes ?? 0)) * 60_000
      : 0;
    const nextAt = startsWithWait
      ? new Date(Date.now() + waitMs).toISOString()
      : now;

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
        workflow_status: startsWithWait ? "waiting" : "in_progress",
        current_step: 0,
        next_action_at: nextAt,
        enrollment_source: enrollmentSource,
        source_event_id: params.sourceEventId ?? null,
        campaign_run_id: params.campaignRunId ?? null,
        enrolled_at: now,
        occurred_at: occurredAtIso,
      })
      .select("id, phone, email, first_name, last_name, full_name, job_type")
      .single();
    if (recipErr) {
      // Unique source_event_id race → treat as already enrolled.
      if (
        params.sourceEventId &&
        (recipErr.code === "23505" || /source_event/i.test(recipErr.message))
      ) {
        await releaseUsage(params.organizationId, "bulk_review_requests_used", 1).catch(
          () => undefined
        );
        const { data: existingEv } = await supabase
          .from("review_request_recipients")
          .select("id, contact_id")
          .eq("source_event_id", params.sourceEventId)
          .maybeSingle();
        return {
          contactId: String(existingEv?.contact_id ?? contactId),
          recipientId: String(existingEv?.id ?? ""),
          messageIds: [],
          alreadyEnrolled: true,
        };
      }
      throw new Error(recipErr.message);
    }
    recipientIdForRollback = recipient.id as string;

    if (startsWithWait) {
      return {
        contactId,
        recipientId: recipient.id as string,
        messageIds: [],
        alreadyEnrolled: false,
      };
    }

    const tz = String(campaign.timezone || "America/New_York");
    const campaignStart = campaign.start_date
      ? String(campaign.start_date).slice(0, 10)
      : null;
    const todayYmd = ymdInTimeZone(new Date(), tz);
    const startDate =
      campaignStart && campaignStart > todayYmd ? campaignStart : todayYmd;
    const scheduleConfig: ScheduleConfig = {
      startDate,
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
      (campaign.email_template_id as string | null) ??
        (campaign.template_id as string | null)
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
      const stepKey = step?.step_key ?? "initial";
      const sendStep =
        step ??
        ({
          step_key: stepKey,
          step_type: slot.channel === "email" ? "send_email" : "send_sms",
          config: {},
        } as SequenceStep);
      const vars = buildCampaignTemplateVars({
        firstName,
        lastName: (recipient.last_name as string | null) ?? null,
        fullName: (recipient.full_name as string | null) ?? firstName,
        businessName: business.name,
        reviewLink: trackingUrl,
        serviceType:
          (recipient.job_type as string | null) ?? params.contact.jobType ?? "recent service",
        unsubscribeLink:
          "Reply STOP to opt out of SMS. Use the email unsubscribe link to stop emails.",
      });
      const { subject, body } = renderStepMessage({
        step: sendStep,
        channel: slot.channel,
        vars,
        fallbackSmsBody: defaultSmsBody(),
        fallbackEmailSubject: defaultEmailSubject(),
        fallbackEmailBody: defaultEmailBody(),
        templateSubject: emailTemplate?.subject ?? null,
        templateBody:
          slot.channel === "sms" ? (smsTemplate?.body ?? null) : (emailTemplate?.body ?? null),
      });
      const scheduledFor = new Date(slot.scheduledFor.getTime() + delayMs);
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
      .select("id, channel, recipient_id, step_key, tracking_url");
    if (msgErr) throw new Error(msgErr.message);

    for (const msg of insertedMsgs ?? []) {
      if (msg.channel !== "email") continue;
      const unsub = buildUnsubscribeUrl(String(msg.id));
      if (!unsub) continue;
      const sendStep =
        step ??
        ({
          step_key: String(msg.step_key ?? "initial"),
          step_type: "send_email",
          config: {},
        } as SequenceStep);
      const rendered = renderStepMessage({
        step: sendStep,
        channel: "email",
        vars: buildCampaignTemplateVars({
          firstName,
          lastName: (recipient.last_name as string | null) ?? null,
          fullName: (recipient.full_name as string | null) ?? firstName,
          businessName: business.name,
          reviewLink: String(msg.tracking_url ?? ""),
          serviceType:
            (recipient.job_type as string | null) ?? params.contact.jobType ?? "recent service",
          unsubscribeLink: unsub,
        }),
        fallbackSmsBody: defaultSmsBody(),
        fallbackEmailSubject: defaultEmailSubject(),
        fallbackEmailBody: defaultEmailBody(),
        templateSubject: emailTemplate?.subject ?? null,
        templateBody: emailTemplate?.body ?? null,
      });
      await supabase
        .from("review_request_messages")
        .update({ subject: rendered.subject, message_body: rendered.body })
        .eq("id", msg.id);
    }

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
    if (recipientIdForRollback) {
      await supabase
        .from("review_request_messages")
        .delete()
        .eq("recipient_id", recipientIdForRollback);
      await supabase
        .from("review_request_recipients")
        .delete()
        .eq("id", recipientIdForRollback);
    }
    await releaseUsage(params.organizationId, "bulk_review_requests_used", 1).catch(() => undefined);
    throw err;
  }
}
