import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import {
  buildInboundReplyAddress,
  type BrevoInboundItem,
} from "@/lib/reputation/inbound-reply";
import { appendSmsOptOut, normalizePhoneE164, phoneDigitsForMatch } from "@/lib/reputation/phone";
import { renderTemplate } from "@/lib/reputation/template-vars";
import { sendTwilioSms } from "@/lib/reputation/twilio";

type ServiceClient = ReturnType<typeof createServiceClient>;

async function assertNotSuppressed(params: {
  businessId: string;
  phone?: string | null;
  email?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  if (params.phone) {
    const { data } = await supabase
      .from("review_request_suppression")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("phone", params.phone)
      .limit(1);
    if (data?.length) throw new Error("This contact has opted out of review requests");
  }
  if (params.email) {
    const { data } = await supabase
      .from("review_request_suppression")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("email", params.email.toLowerCase())
      .limit(1);
    if (data?.length) throw new Error("This contact has opted out of review requests");
  }
}

export type SendReviewEmailInput = {
  businessId: string;
  organizationId: string;
  customerName: string;
  customerEmail: string;
  serviceType?: string | null;
  templateId?: string | null;
  customMessage?: string | null;
};

export type SendReviewSmsInput = {
  businessId: string;
  organizationId: string;
  customerName: string;
  customerPhone: string;
  serviceType?: string | null;
  templateId?: string | null;
  customMessage?: string | null;
};

export type LogManualSendInput = {
  businessId: string;
  organizationId: string;
  customerName?: string | null;
  channel?: string | null;
  notes?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceType?: string | null;
};

type TemplateRow = {
  id: string;
  channel: string;
  subject?: string | null;
  body: string;
  is_default?: boolean;
};

type LinkRow = {
  id: string;
  review_url: string;
};

async function loadActiveLink(
  supabase: ServiceClient,
  businessId: string
): Promise<LinkRow | null> {
  const { data } = await supabase
    .from("review_request_links")
    .select("id, review_url")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function loadTemplate(
  supabase: ServiceClient,
  businessId: string,
  channel: "email" | "sms",
  templateId?: string | null
): Promise<TemplateRow | null> {
  if (templateId) {
    const { data } = await supabase
      .from("review_request_templates")
      .select("id, channel, subject, body, is_default")
      .eq("id", templateId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (data) return data;
  }

  const { data } = await supabase
    .from("review_request_templates")
    .select("id, channel, subject, body, is_default")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

function templateVars(params: {
  customerName: string;
  businessName: string;
  reviewUrl: string;
  serviceType?: string | null;
}) {
  return {
    customer_name: params.customerName,
    business_name: params.businessName,
    review_link: params.reviewUrl,
    service_type: params.serviceType?.trim() || "recent project",
  };
}

async function upsertContact(
  supabase: ServiceClient,
  params: {
    organizationId: string;
    businessId: string;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    serviceType?: string | null;
    notes?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("review_request_contacts")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      customer_name: params.customerName ?? null,
      customer_email: params.customerEmail ?? null,
      customer_phone: params.customerPhone ?? null,
      service_type: params.serviceType ?? null,
      notes: params.notes ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function insertSend(
  supabase: ServiceClient,
  row: {
    organizationId: string;
    businessId: string;
    contactId?: string | null;
    linkId: string;
    channel: "email" | "sms" | "manual";
    recipientEmail?: string | null;
    recipientPhone?: string | null;
    subject?: string | null;
    messageBody: string;
    reviewUrl: string;
    status: "queued" | "sent" | "failed";
    provider?: "brevo" | "twilio" | "manual" | null;
    providerMessageId?: string | null;
    errorMessage?: string | null;
    sentAt?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("review_request_sends")
    .insert({
      organization_id: row.organizationId,
      business_id: row.businessId,
      contact_id: row.contactId ?? null,
      link_id: row.linkId,
      channel: row.channel,
      recipient_email: row.recipientEmail ?? null,
      recipient_phone: row.recipientPhone ?? null,
      subject: row.subject ?? null,
      message_body: row.messageBody,
      review_url: row.reviewUrl,
      status: row.status,
      provider: row.provider ?? null,
      provider_message_id: row.providerMessageId ?? null,
      error_message: row.errorMessage ?? null,
      sent_at: row.sentAt ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function insertEvent(
  supabase: ServiceClient,
  params: {
    organizationId: string;
    businessId: string;
    linkId: string;
    sendId?: string | null;
    eventType: string;
    channel?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
    customerPhone?: string | null;
    serviceType?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { data, error } = await supabase
    .from("review_request_events")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      link_id: params.linkId,
      send_id: params.sendId ?? null,
      event_type: params.eventType,
      channel: params.channel ?? null,
      customer_name: params.customerName ?? null,
      customer_email: params.customerEmail ?? null,
      customer_phone: params.customerPhone ?? null,
      service_type: params.serviceType ?? null,
      notes: params.notes ?? null,
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function resolveReplyToEmail(sendId: string, business: { phone?: string | null }): string | null {
  void business;
  return (
    buildInboundReplyAddress(sendId) ??
    process.env.REVIEW_REPLY_FORWARD_EMAIL?.trim() ??
    null
  );
}

export async function sendReviewRequestEmail(input: SendReviewEmailInput) {
  const supabase = createServiceClient();
  const business = await getBusiness(input.businessId, input.organizationId);
  if (!business) throw new Error("Business not found");

  const email = input.customerEmail?.trim();
  if (!email) throw new Error("Customer email is required");

  await assertNotSuppressed({ businessId: input.businessId, email });

  const link = await loadActiveLink(supabase, input.businessId);
  if (!link) throw new Error("Review link missing. Generate review link first.");

  const template = await loadTemplate(supabase, input.businessId, "email", input.templateId);
  const vars = templateVars({
    customerName: input.customerName,
    businessName: business.name,
    reviewUrl: link.review_url,
    serviceType: input.serviceType,
  });

  const subject = template?.subject
    ? renderTemplate(template.subject, vars)
    : `Quick favor from ${business.name}`;

  const body = input.customMessage?.trim()
    ? renderTemplate(input.customMessage, vars)
    : template
      ? renderTemplate(template.body, vars)
      : `Hi ${input.customerName},\n\nThanks again for choosing ${business.name}. If you have a minute, would you leave us a quick honest Google review?\n\n${link.review_url}`;

  const contactId = await upsertContact(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    customerName: input.customerName,
    customerEmail: email,
    serviceType: input.serviceType,
  });

  const sendRow = await insertSend(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    contactId,
    linkId: link.id,
    channel: "email",
    recipientEmail: email,
    subject,
    messageBody: body,
    reviewUrl: link.review_url,
    status: "queued",
    provider: "brevo",
  });

  const result = await sendBrevoEmail({
    toEmail: email,
    toName: input.customerName,
    fromName: business.name,
    subject,
    textBody: body,
    replyToEmail: resolveReplyToEmail(sendRow.id, business),
  });

  const now = new Date().toISOString();

  if (!result.ok) {
    await supabase
      .from("review_request_sends")
      .update({ status: "failed", error_message: result.error, sent_at: now })
      .eq("id", sendRow.id);

    await insertEvent(supabase, {
      organizationId: input.organizationId,
      businessId: input.businessId,
      linkId: link.id,
      sendId: sendRow.id,
      eventType: "failed",
      channel: "email",
      customerName: input.customerName,
      customerEmail: email,
      serviceType: input.serviceType,
      metadata: { error: result.error },
    });

    return { ok: false as const, error: result.error, sendId: sendRow.id };
  }

  await supabase
    .from("review_request_sends")
    .update({
      status: "sent",
      provider_message_id: result.messageId,
      sent_at: now,
    })
    .eq("id", sendRow.id);

  await insertEvent(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    linkId: link.id,
    sendId: sendRow.id,
    eventType: "email_sent",
    channel: "email",
    customerName: input.customerName,
    customerEmail: email,
    serviceType: input.serviceType,
    metadata: { providerMessageId: result.messageId },
  });

  return { ok: true as const, sendId: sendRow.id, messageId: result.messageId };
}

export async function sendReviewRequestSms(input: SendReviewSmsInput) {
  const supabase = createServiceClient();
  const business = await getBusiness(input.businessId, input.organizationId);
  if (!business) throw new Error("Business not found");

  const phone = input.customerPhone?.trim();
  if (!phone) throw new Error("Customer phone is required");

  const normalized = normalizePhoneE164(phone);
  if (!normalized) throw new Error("Invalid phone number format");

  await assertNotSuppressed({ businessId: input.businessId, phone: normalized });

  const link = await loadActiveLink(supabase, input.businessId);
  if (!link) throw new Error("Review link missing. Generate review link first.");

  const template = await loadTemplate(supabase, input.businessId, "sms", input.templateId);
  const vars = templateVars({
    customerName: input.customerName,
    businessName: business.name,
    reviewUrl: link.review_url,
    serviceType: input.serviceType,
  });

  let body = input.customMessage?.trim()
    ? renderTemplate(input.customMessage, vars)
    : template
      ? renderTemplate(template.body, vars)
      : `Hi ${input.customerName}, this is ${business.name}. Thanks again for choosing us. Could you leave us a quick honest Google review? ${link.review_url}`;

  if (!body.includes(business.name)) {
    body = `Hi ${input.customerName}, this is ${business.name}. ${body}`;
  }

  body = appendSmsOptOut(body);

  const contactId = await upsertContact(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    customerName: input.customerName,
    customerPhone: normalized,
    serviceType: input.serviceType,
  });

  const sendRow = await insertSend(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    contactId,
    linkId: link.id,
    channel: "sms",
    recipientPhone: normalized,
    messageBody: body,
    reviewUrl: link.review_url,
    status: "queued",
    provider: "twilio",
  });

  const result = await sendTwilioSms({ toPhone: normalized, body });

  const now = new Date().toISOString();

  if (!result.ok) {
    await supabase
      .from("review_request_sends")
      .update({ status: "failed", error_message: result.error, sent_at: now })
      .eq("id", sendRow.id);

    await insertEvent(supabase, {
      organizationId: input.organizationId,
      businessId: input.businessId,
      linkId: link.id,
      sendId: sendRow.id,
      eventType: "failed",
      channel: "sms",
      customerName: input.customerName,
      customerPhone: normalized,
      serviceType: input.serviceType,
      metadata: { error: result.error },
    });

    return { ok: false as const, error: result.error, sendId: sendRow.id };
  }

  await supabase
    .from("review_request_sends")
    .update({
      status: "sent",
      provider_message_id: result.messageSid,
      sent_at: now,
    })
    .eq("id", sendRow.id);

  await insertEvent(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    linkId: link.id,
    sendId: sendRow.id,
    eventType: "sms_sent",
    channel: "sms",
    customerName: input.customerName,
    customerPhone: normalized,
    serviceType: input.serviceType,
    metadata: { providerMessageId: result.messageSid, trialTemplate: result.usedTrialTemplate ?? false },
  });

  return {
    ok: true as const,
    sendId: sendRow.id,
    messageSid: result.messageSid,
    usedTrialTemplate: result.usedTrialTemplate,
  };
}

export async function logManualReviewSend(input: LogManualSendInput) {
  const supabase = createServiceClient();
  const business = await getBusiness(input.businessId, input.organizationId);
  if (!business) throw new Error("Business not found");

  const link = await loadActiveLink(supabase, input.businessId);
  if (!link) throw new Error("Review link missing. Generate review link first.");

  const contactId = await upsertContact(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    serviceType: input.serviceType,
    notes: input.notes,
  });

  const channel = (input.channel === "email" || input.channel === "sms" ? input.channel : "manual") as
    | "email"
    | "sms"
    | "manual";

  const now = new Date().toISOString();
  const sendRow = await insertSend(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    contactId,
    linkId: link.id,
    channel: channel === "email" || channel === "sms" ? channel : "manual",
    recipientEmail: input.customerEmail ?? null,
    recipientPhone: input.customerPhone ?? null,
    messageBody: input.notes?.trim() || "Manual review request logged",
    reviewUrl: link.review_url,
    status: "sent",
    provider: "manual",
    sentAt: now,
  });

  await insertEvent(supabase, {
    organizationId: input.organizationId,
    businessId: input.businessId,
    linkId: link.id,
    sendId: sendRow.id,
    eventType: "manual_sent",
    channel: input.channel ?? "manual",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    serviceType: input.serviceType,
    notes: input.notes,
  });

  return sendRow;
}

export async function loadReviewRequestStats(businessId: string, organizationId: string) {
  const supabase = createServiceClient();
  await getBusiness(businessId, organizationId);

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sends } = await supabase
    .from("review_request_sends")
    .select("*, review_request_contacts(customer_name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: events } = await supabase
    .from("review_request_events")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  const all = sends ?? [];
  const sentRows = all.filter((s) => s.status === "sent");
  const failedRows = all.filter((s) => s.status === "failed");

  const countInRange = (since: string) =>
    sentRows.filter((s) => (s.sent_at ?? s.created_at) >= since).length;

  const replyEvents = (events ?? []).filter((e) => e.event_type === "reply_received");
  const replySendIds = new Set(
    replyEvents.map((e) => e.send_id).filter((id): id is string => Boolean(id))
  );

  const recentReplies = replyEvents.slice(0, 15).map((e) => {
    const meta = (e.metadata ?? {}) as Record<string, unknown>;
    return {
      id: e.id,
      send_id: e.send_id,
      channel: e.channel ?? "email",
      customer_name: e.customer_name,
      customer_email: e.customer_email,
      customer_phone: e.customer_phone,
      reply_body: String(meta.replyBody ?? meta.reply_body ?? ""),
      from: (meta.from as string | null) ?? e.customer_email ?? null,
      subject: (meta.subject as string | null) ?? null,
      created_at: e.created_at,
    };
  });

  return {
    total_sent: sentRows.length,
    email_sent: sentRows.filter((s) => s.channel === "email").length,
    sms_sent: sentRows.filter((s) => s.channel === "sms").length,
    manual_sent: sentRows.filter((s) => s.channel === "manual").length,
    failed: failedRows.length,
    replies: replyEvents.length,
    last_7_days: countInRange(sevenDaysAgo),
    last_30_days: countInRange(thirtyDaysAgo),
    recent_sends: all.slice(0, 25).map((s) => ({
      ...s,
      has_reply: replySendIds.has(s.id),
    })),
    recent_replies: recentReplies,
    recent_events: (events ?? []).slice(0, 25),
    trial_sms_template: process.env.TWILIO_TRIAL_SMS_TEMPLATE?.trim() || null,
    inbound_reply_domain: process.env.REVIEW_REQUEST_REPLY_DOMAIN?.trim() || null,
  };
}

export async function handleTwilioSmsReply(params: {
  from: string;
  body: string;
  messageSid?: string;
}) {
  const supabase = createServiceClient();
  const fromDigits = phoneDigitsForMatch(params.from);

  const { data: recentSends } = await supabase
    .from("review_request_sends")
    .select("*")
    .eq("channel", "sms")
    .order("created_at", { ascending: false })
    .limit(100);

  const match =
    (recentSends ?? []).find((s) => {
      if (!s.recipient_phone) return false;
      return phoneDigitsForMatch(s.recipient_phone) === fromDigits;
    }) ?? null;

  if (!match) {
    return { matched: false as const };
  }

  await insertEvent(supabase, {
    organizationId: match.organization_id,
    businessId: match.business_id,
    linkId: match.link_id,
    sendId: match.id,
    eventType: "reply_received",
    channel: "sms",
    metadata: {
      replyBody: params.body,
      twilioMessageSid: params.messageSid ?? null,
      from: params.from,
    },
  });

  const forwardTo = process.env.REVIEW_REPLY_FORWARD_EMAIL;
  if (forwardTo) {
    const business = await getBusiness(match.business_id, match.organization_id);
    await sendBrevoEmail({
      toEmail: forwardTo,
      subject: `Review request reply${business ? ` — ${business.name}` : ""}`,
      textBody: `Customer replied to a review request:\n\n${params.body}\n\nFrom: ${params.from}`,
    });
  }

  return { matched: true as const, sendId: match.id };
}

export async function handleBrevoInboundEmail(item: BrevoInboundItem) {
  const supabase = createServiceClient();

  let match: {
    id: string;
    organization_id: string;
    business_id: string;
    link_id: string;
    recipient_email: string | null;
    contact_id: string | null;
  } | null = null;

  if (item.sendId) {
    const { data } = await supabase
      .from("review_request_sends")
      .select("id, organization_id, business_id, link_id, recipient_email, contact_id")
      .eq("id", item.sendId)
      .eq("channel", "email")
      .maybeSingle();
    match = data;
  }

  if (!match && item.fromEmail) {
    const { data: recentSends } = await supabase
      .from("review_request_sends")
      .select("id, organization_id, business_id, link_id, recipient_email, contact_id, created_at")
      .eq("channel", "email")
      .ilike("recipient_email", item.fromEmail)
      .order("created_at", { ascending: false })
      .limit(1);
    match = recentSends?.[0] ?? null;
  }

  if (!match) {
    return { matched: false as const };
  }

  const { data: contact } = match.contact_id
    ? await supabase
        .from("review_request_contacts")
        .select("customer_name")
        .eq("id", match.contact_id)
        .maybeSingle()
    : { data: null };

  await insertEvent(supabase, {
    organizationId: match.organization_id,
    businessId: match.business_id,
    linkId: match.link_id,
    sendId: match.id,
    eventType: "reply_received",
    channel: "email",
    customerName: contact?.customer_name ?? item.fromName,
    customerEmail: item.fromEmail ?? match.recipient_email,
    metadata: {
      replyBody: item.replyBody,
      subject: item.subject,
      from: item.fromEmail,
      fromName: item.fromName,
      inReplyTo: item.inReplyTo,
      brevoUuid: item.uuid,
    },
  });

  const forwardTo = process.env.REVIEW_REPLY_FORWARD_EMAIL?.trim();
  if (forwardTo) {
    const business = await getBusiness(match.business_id, match.organization_id);
    const customerLabel = item.fromEmail ?? "Customer";
    await sendBrevoEmail({
      toEmail: forwardTo,
      subject: `Review request email reply${business ? ` — ${business.name}` : ""}`,
      textBody: `${customerLabel} replied to your review request:\n\n${item.replyBody || "(empty message)"}\n\n— Maps Growth`,
    });
  }

  return { matched: true as const, sendId: match.id };
}

export { phoneDigitsForMatch };
