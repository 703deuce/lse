import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import type { CsvMapTarget } from "@/lib/reputation/bulk-csv";
import type { ValidatedRecipient } from "@/lib/reputation/bulk-validate";
import {
  buildMessageSchedule,
  estimateBusinessDays,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { renderTemplate } from "@/lib/reputation/template-vars";
import { buildTrackingUrl, generateTrackingToken } from "@/lib/reputation/tracking";

export type CampaignChannel = "sms" | "email" | "both";
export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "cancelled";

export type CreateCampaignInput = {
  organizationId: string;
  businessId: string;
  name: string;
  channel: CampaignChannel;
  templateId?: string | null;
  dailySendLimit: number;
  sendDays: number[];
  sendWindowStart: string;
  sendWindowEnd: string;
  timezone: string;
  duplicateProtectionDays: number;
  startDate: string;
  consentConfirmed: boolean;
  filename?: string;
  mapping: Record<string, CsvMapTarget>;
  recipients: ValidatedRecipient[];
  status: "draft" | "scheduled" | "active";
};

function displayName(r: ValidatedRecipient): string {
  if (r.first_name?.trim()) return r.first_name.trim();
  if (r.full_name?.trim()) return r.full_name.trim();
  if (r.first_name || r.last_name) return [r.first_name, r.last_name].filter(Boolean).join(" ");
  return "there";
}

function channelsForRecipient(
  channel: CampaignChannel,
  r: ValidatedRecipient
): Array<"sms" | "email"> {
  const out: Array<"sms" | "email"> = [];
  if ((channel === "sms" || channel === "both") && r.phone) out.push("sms");
  if ((channel === "email" || channel === "both") && r.email) out.push("email");
  if (channel === "sms" && !r.phone && r.email) return [];
  if (channel === "email" && !r.email && r.phone) return [];
  return out;
}

async function loadGoogleReviewUrl(businessId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("review_request_links")
    .select("review_url")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data?.review_url) throw new Error("Generate a review link before starting a campaign.");
  return data.review_url;
}

async function loadTemplate(businessId: string, channel: "sms" | "email", templateId?: string | null) {
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

export async function createReviewCampaign(input: CreateCampaignInput) {
  const supabase = createServiceClient();
  const business = await getBusiness(input.businessId, input.organizationId);
  if (!business) throw new Error("Business not found");
  if (input.status !== "draft" && !input.consentConfirmed) {
    throw new Error("Consent confirmation is required.");
  }

  const googleReviewUrl = await loadGoogleReviewUrl(input.businessId);
  const ready = input.recipients.filter((r) => r.status === "ready");
  const skipped = input.recipients.length - ready.length;

  const { data: campaign, error: campErr } = await supabase
    .from("review_request_campaigns")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      name: input.name,
      status: input.status === "draft" ? "draft" : input.status === "active" ? "active" : "scheduled",
      channel: input.channel,
      template_id: input.templateId ?? null,
      daily_send_limit: input.dailySendLimit,
      send_days: input.sendDays,
      send_window_start: input.sendWindowStart,
      send_window_end: input.sendWindowEnd,
      timezone: input.timezone,
      duplicate_protection_days: input.duplicateProtectionDays,
      start_date: input.startDate,
      consent_confirmed: input.consentConfirmed,
      started_at: input.status === "active" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (campErr) throw new Error(campErr.message);

  const { data: upload } = await supabase
    .from("review_request_uploads")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      campaign_id: campaign.id,
      filename: input.filename ?? "upload.csv",
      total_rows: input.recipients.length,
      valid_rows: ready.length,
      skipped_rows: skipped,
      mapping_json: input.mapping,
    })
    .select("id")
    .single();

  const recipientRows = input.recipients.map((r) => ({
    organization_id: input.organizationId,
    business_id: input.businessId,
    campaign_id: campaign.id,
    upload_id: upload?.id,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    full_name: r.full_name ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    service_date: r.service_date ?? null,
    job_type: r.job_type ?? null,
    city: r.city ?? null,
    notes: r.notes ?? null,
    status: r.status,
    skip_reason: r.skip_reason ?? null,
  }));

  const { data: insertedRecipients, error: recErr } = await supabase
    .from("review_request_recipients")
    .insert(recipientRows)
    .select("id, status, phone, email, first_name, last_name, full_name, job_type");

  if (recErr) throw new Error(recErr.message);

  const readyRecipients = (insertedRecipients ?? []).filter((r) => r.status === "ready");
  const messageItems: Array<{ recipientId: string; channel: "sms" | "email" }> = [];

  for (const r of readyRecipients) {
    const vr = input.recipients.find((x) => x.rowIndex === undefined) ?? ({} as ValidatedRecipient);
    void vr;
    const channels = channelsForRecipient(input.channel, {
      ...r,
      rowIndex: 0,
      status: "ready",
      phone: r.phone ?? undefined,
      email: r.email ?? undefined,
      first_name: r.first_name ?? undefined,
      last_name: r.last_name ?? undefined,
      full_name: r.full_name ?? undefined,
      job_type: r.job_type ?? undefined,
    });
    for (const ch of channels) {
      messageItems.push({ recipientId: r.id as string, channel: ch });
    }
  }

  if (messageItems.length) {
    const scheduleConfig: ScheduleConfig = {
      startDate: input.startDate,
      dailySendLimit: input.dailySendLimit,
      sendDays: input.sendDays,
      windowStart: input.sendWindowStart,
      windowEnd: input.sendWindowEnd,
      timezone: input.timezone,
    };
    const slots = buildMessageSchedule(messageItems, scheduleConfig);

    const smsTemplate = await loadTemplate(input.businessId, "sms", input.templateId);
    const emailTemplate = await loadTemplate(input.businessId, "email", input.templateId);

    const messageRows = [];
    for (const slot of slots) {
      const recipient = readyRecipients.find((r) => r.id === slot.recipientId)!;
      const token = generateTrackingToken();
      const trackingUrl = buildTrackingUrl(token);
      const name = displayName({
        rowIndex: 0,
        status: "ready",
        first_name: recipient.first_name ?? undefined,
        last_name: recipient.last_name ?? undefined,
        full_name: recipient.full_name ?? undefined,
      });
      const vars = {
        first_name: name === "there" ? "there" : name.split(" ")[0] ?? name,
        full_name: recipient.full_name ?? name,
        customer_name: name,
        business_name: business.name,
        review_link: trackingUrl,
        service_type: recipient.job_type ?? "recent service",
      };

      let subject: string | null = null;
      let body: string;
      if (slot.channel === "sms") {
        body = renderTemplate(smsTemplate?.body ?? defaultSmsBody(), vars);
      } else {
        subject = renderTemplate(emailTemplate?.subject ?? defaultEmailSubject(), vars);
        body = renderTemplate(emailTemplate?.body ?? defaultEmailBody(), vars);
      }

      messageRows.push({
        organization_id: input.organizationId,
        business_id: input.businessId,
        campaign_id: campaign.id,
        recipient_id: slot.recipientId,
        channel: slot.channel,
        status: "queued",
        tracking_token: token,
        tracking_url: trackingUrl,
        google_review_url: googleReviewUrl,
        subject,
        message_body: body,
        scheduled_for: slot.scheduledFor.toISOString(),
      });
    }

    if (messageRows.length) {
      const { error: msgErr } = await supabase.from("review_request_messages").insert(messageRows);
      if (msgErr) throw new Error(msgErr.message);
    }
  }

  const businessDays = estimateBusinessDays(messageItems.length, input.dailySendLimit);

  return {
    campaign,
    uploadId: upload?.id,
    validCount: ready.length,
    skippedCount: skipped,
    messageCount: messageItems.length,
    businessDays,
  };
}

export async function listCampaigns(businessId: string) {
  const supabase = createServiceClient();
  const { data: campaigns, error } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!campaigns?.length) return [];

  const ids = campaigns.map((c) => c.id);
  const { data: messages } = await supabase
    .from("review_request_messages")
    .select("campaign_id, status")
    .in("campaign_id", ids);

  const { data: recipients } = await supabase
    .from("review_request_recipients")
    .select("campaign_id, status")
    .in("campaign_id", ids);

  return campaigns.map((c) => {
    const msgs = (messages ?? []).filter((m) => m.campaign_id === c.id);
    const recs = (recipients ?? []).filter((r) => r.campaign_id === c.id);
    return {
      ...c,
      recipients_total: recs.length,
      recipients_ready: recs.filter((r) => r.status === "ready").length,
      queued: msgs.filter((m) => m.status === "queued" || m.status === "sending").length,
      sent: msgs.filter((m) => m.status === "sent" || m.status === "delivered" || m.status === "clicked").length,
      failed: msgs.filter((m) => m.status === "failed").length,
      clicked: msgs.filter((m) => m.status === "clicked").length,
      opted_out: msgs.filter((m) => m.status === "opted_out").length,
    };
  });
}

export async function updateCampaignStatus(
  campaignId: string,
  businessId: string,
  status: CampaignStatus
) {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active") patch.started_at = new Date().toISOString();
  if (status === "completed" || status === "cancelled") {
    patch.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("review_request_campaigns")
    .update(patch)
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function duplicateCampaign(campaignId: string, businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  const { data: orig } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("business_id", businessId)
    .single();
  if (!orig) throw new Error("Campaign not found");

  const { data: recs } = await supabase
    .from("review_request_recipients")
    .select("*")
    .eq("campaign_id", campaignId);

  const { data: upload } = await supabase
    .from("review_request_uploads")
    .select("mapping_json, filename")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const recipients: ValidatedRecipient[] = (recs ?? []).map((r, i) => ({
    rowIndex: i,
    first_name: r.first_name ?? undefined,
    last_name: r.last_name ?? undefined,
    full_name: r.full_name ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    service_date: r.service_date ?? undefined,
    job_type: r.job_type ?? undefined,
    city: r.city ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status as ValidatedRecipient["status"],
    skip_reason: r.skip_reason ?? undefined,
  }));

  return createReviewCampaign({
    organizationId,
    businessId,
    name: `${orig.name} (copy)`,
    channel: orig.channel as CampaignChannel,
    templateId: orig.template_id,
    dailySendLimit: orig.daily_send_limit,
    sendDays: orig.send_days as number[],
    sendWindowStart: orig.send_window_start,
    sendWindowEnd: orig.send_window_end,
    timezone: orig.timezone,
    duplicateProtectionDays: orig.duplicate_protection_days,
    startDate: new Date().toISOString().slice(0, 10),
    consentConfirmed: orig.consent_confirmed,
    filename: upload?.filename ?? undefined,
    mapping: (upload?.mapping_json ?? {}) as Record<string, CsvMapTarget>,
    recipients,
    status: "draft",
  });
}

export async function recordTrackingClick(params: {
  token: string;
  ip?: string;
  userAgent?: string;
}) {
  const supabase = createServiceClient();
  const { data: message } = await supabase
    .from("review_request_messages")
    .select("*")
    .eq("tracking_token", params.token)
    .maybeSingle();

  if (!message) return null;

  const now = new Date().toISOString();
  if (!message.clicked_at) {
    await supabase
      .from("review_request_messages")
      .update({ status: "clicked", clicked_at: now, updated_at: now })
      .eq("id", message.id);

    await supabase.from("review_request_clicks").insert({
      organization_id: message.organization_id,
      business_id: message.business_id,
      campaign_id: message.campaign_id,
      recipient_id: message.recipient_id,
      message_id: message.id,
      tracking_token: params.token,
      ip_hash: params.ip ? hashIp(params.ip) : null,
      user_agent: params.userAgent?.slice(0, 500) ?? null,
    });
  }

  return message.google_review_url as string;
}

function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = (h << 5) - h + ip.charCodeAt(i);
  return `ip_${Math.abs(h)}`;
}
