import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import {
  buildMessageSchedule,
  ymdInTimeZone,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { renderTemplate } from "@/lib/reputation/template-vars";
import { buildTrackingUrl, generateTrackingToken } from "@/lib/reputation/tracking";
import {
  defaultReviewRequestSequence,
  indexAfterSend,
  interpretSequenceStep,
  normalizeSequenceSteps,
  resolveWaveChannels,
  type RecipientFacts,
  type SequenceStep,
} from "@/lib/reputation/sequence-engine";
import { logger } from "@/lib/observability/logger";

type ServiceClient = ReturnType<typeof createServiceClient>;

async function loadTemplate(
  supabase: ServiceClient,
  businessId: string,
  channel: "sms" | "email",
  templateId?: string | null
) {
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

function defaultSmsBody(): string {
  return "Hi {{first_name}}, thanks for choosing {{business_name}}. Would you be willing to share your honest feedback on Google? {{review_link}} Reply STOP to opt out.";
}

function defaultEmailSubject(): string {
  return "How was your experience with {{business_name}}?";
}

function defaultEmailBody(): string {
  return `Hi {{first_name}},

Thanks for choosing {{business_name}}. We'd appreciate your honest feedback:

{{review_link}}

Thank you.`;
}

export async function loadRecipientFacts(
  supabase: ServiceClient,
  recipient: {
    id: string;
    phone?: string | null;
    email?: string | null;
    replied_at?: string | null;
    review_detected_at?: string | null;
  },
  businessId: string
): Promise<RecipientFacts> {
  const { data: messages } = await supabase
    .from("review_request_messages")
    .select("status, delivered_at, clicked_at")
    .eq("recipient_id", recipient.id);

  let delivered = false;
  let clicked = false;
  for (const m of messages ?? []) {
    const s = String(m.status);
    if (s === "delivered" || s === "clicked" || m.delivered_at) delivered = true;
    if (s === "clicked" || m.clicked_at) clicked = true;
  }
  // Provider delivery webhooks may lag — treat sent as provisional delivery for sequence gates.
  if (!delivered && (messages ?? []).some((m) => ["sent", "delivered", "clicked"].includes(String(m.status)))) {
    delivered = true;
  }

  const now = Date.now();
  let smsOptedOut = false;
  let emailOptedOut = false;
  if (recipient.phone) {
    const { data } = await supabase
      .from("review_request_suppression")
      .select("id, expires_at")
      .eq("business_id", businessId)
      .eq("phone", recipient.phone)
      .limit(5);
    smsOptedOut = Boolean(
      (data ?? []).some((s) => !s.expires_at || new Date(String(s.expires_at)).getTime() > now)
    );
  }
  if (recipient.email) {
    const { data } = await supabase
      .from("review_request_suppression")
      .select("id, expires_at")
      .eq("business_id", businessId)
      .eq("email", recipient.email.toLowerCase())
      .limit(5);
    emailOptedOut = Boolean(
      (data ?? []).some((s) => !s.expires_at || new Date(String(s.expires_at)).getTime() > now)
    );
  }

  const hasPhone = Boolean(recipient.phone) && !smsOptedOut;
  const hasEmail = Boolean(recipient.email) && !emailOptedOut;
  // Only hard-stop when every available channel is suppressed.
  const optedOut =
    (!recipient.phone || smsOptedOut) && (!recipient.email || emailOptedOut);

  return {
    delivered,
    clicked,
    replied: Boolean(recipient.replied_at),
    optedOut,
    reviewDetected: Boolean(recipient.review_detected_at),
    hasPhone,
    hasEmail,
  };
}

async function enqueueSendForRecipient(params: {
  supabase: ServiceClient;
  campaign: Record<string, unknown>;
  recipient: Record<string, unknown>;
  step: SequenceStep;
  channel: "sms" | "email";
  scheduledFor: Date;
}) {
  const { supabase, campaign, recipient, step, channel, scheduledFor } = params;
  const businessId = String(campaign.business_id);
  const organizationId = String(campaign.organization_id);
  const campaignId = String(campaign.id);

  const idempotencyKey = `${campaignId}:${recipient.id}:${step.step_key}:${channel}`;
  const { data: existing } = await supabase
    .from("review_request_messages")
    .select("id")
    .eq("business_id", businessId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: link } = await supabase
    .from("review_request_links")
    .select("review_url")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (!link?.review_url) throw new Error("Missing Google review URL");

  const business = await getBusiness(businessId, organizationId);
  const templateIdForChannel =
    channel === "email"
      ? ((campaign.email_template_id as string | null) ??
        (campaign.template_id as string | null))
      : ((campaign.template_id as string | null) ?? null);
  const template = await loadTemplate(supabase, businessId, channel, templateIdForChannel);

  const token = generateTrackingToken();
  const trackingUrl = buildTrackingUrl(token);
  const first =
    (recipient.first_name as string | null)?.trim() ||
    (recipient.full_name as string | null)?.trim()?.split(/\s+/)[0] ||
    "there";
  const vars = {
    first_name: first,
    full_name: (recipient.full_name as string | null) ?? first,
    customer_name: first,
    business_name: business?.name ?? "us",
    review_link: trackingUrl,
    service_type: (recipient.job_type as string | null) ?? "recent service",
  };

  let subject: string | null = null;
  let body: string;
  if (channel === "sms") {
    body = renderTemplate(template?.body ?? defaultSmsBody(), vars);
  } else {
    subject = renderTemplate(template?.subject ?? defaultEmailSubject(), vars);
    body = renderTemplate(template?.body ?? defaultEmailBody(), vars);
  }

  const { data: inserted, error } = await supabase
    .from("review_request_messages")
    .insert({
      organization_id: organizationId,
      business_id: businessId,
      campaign_id: campaignId,
      recipient_id: recipient.id,
      channel,
      status: "queued",
      tracking_token: token,
      tracking_url: trackingUrl,
      google_review_url: link.review_url,
      subject,
      message_body: body,
      scheduled_for: scheduledFor.toISOString(),
      step_key: step.step_key,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique idempotency race — treat as success.
    if (error.message?.includes("idx_review_messages_idempotency") || error.code === "23505") {
      return null;
    }
    throw new Error(error.message);
  }
  return inserted?.id ?? null;
}

/**
 * After all messages for a send step are terminal, advance the recipient workflow.
 */
export async function tryAdvanceRecipientAfterSend(params: {
  supabase?: ServiceClient;
  recipientId: string;
  stepKey: string;
}): Promise<void> {
  const supabase = params.supabase ?? createServiceClient();
  const { data: inflight } = await supabase
    .from("review_request_messages")
    .select("id")
    .eq("recipient_id", params.recipientId)
    .eq("step_key", params.stepKey)
    .in("status", ["queued", "sending"])
    .limit(1);
  if (inflight?.length) return;

  const { data: recipient } = await supabase
    .from("review_request_recipients")
    .select("*")
    .eq("id", params.recipientId)
    .maybeSingle();
  if (!recipient) return;
  if (["completed", "stopped", "opted_out", "failed"].includes(String(recipient.workflow_status))) {
    return;
  }

  const { data: campaign } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("id", recipient.campaign_id)
    .maybeSingle();
  if (!campaign) return;

  const steps = normalizeSequenceSteps(
    (campaign.sequence_json as SequenceStep[] | null)?.length
      ? (campaign.sequence_json as SequenceStep[])
      : defaultReviewRequestSequence(
          (campaign.channel as "sms" | "email" | "both") || "sms"
        )
  );
  let sendIdx = steps.findIndex((s) => s.step_key === params.stepKey);
  if (sendIdx < 0) {
    // Legacy / edited sequences: fall back to current_step or first send step.
    const current = Number(recipient.current_step ?? 0);
    const isSend = (t: string | undefined) => t === "send_sms" || t === "send_email";
    if (Number.isFinite(current) && isSend(steps[current]?.step_type)) {
      sendIdx = current;
    } else {
      sendIdx = steps.findIndex((s) => isSend(s.step_type));
    }
  }
  if (sendIdx < 0) {
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "completed",
        next_action_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recipient.id);
    return;
  }

  const nextIdx = indexAfterSend(steps, sendIdx);
  await applyWorkflowFromIndex({
    supabase,
    campaign,
    recipient,
    steps,
    stepIndex: nextIdx,
  });
}

async function applyWorkflowFromIndex(params: {
  supabase: ServiceClient;
  campaign: Record<string, unknown>;
  recipient: Record<string, unknown>;
  steps: SequenceStep[];
  stepIndex: number;
  depth?: number;
}): Promise<void> {
  const { supabase, campaign, recipient, steps } = params;
  let stepIndex = params.stepIndex;
  const depth = params.depth ?? 0;
  if (depth > 20) return;

  const facts = await loadRecipientFacts(
    supabase,
    recipient as {
      id: string;
      phone?: string | null;
      email?: string | null;
      replied_at?: string | null;
      review_detected_at?: string | null;
    },
    String(campaign.business_id)
  );

  const campaignChannel = (["sms", "email", "both"].includes(String(campaign.channel))
    ? String(campaign.channel)
    : "sms") as "sms" | "email" | "both";
  const decision = interpretSequenceStep(steps, stepIndex, facts, new Date(), campaignChannel);
  const nowIso = new Date().toISOString();

  if (decision.action === "stop") {
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: decision.reason === "opted_out" ? "opted_out" : "failed",
        next_action_at: null,
        updated_at: nowIso,
      })
      .eq("id", recipient.id);
    return;
  }

  if (decision.action === "end") {
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "completed",
        current_step: decision.stepIndex,
        next_action_at: null,
        updated_at: nowIso,
      })
      .eq("id", recipient.id);
    return;
  }

  if (decision.action === "wait") {
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "waiting",
        current_step: decision.stepIndex,
        next_action_at: decision.until.toISOString(),
        updated_at: nowIso,
      })
      .eq("id", recipient.id);
    return;
  }

  if (decision.action === "jump") {
    await applyWorkflowFromIndex({
      supabase,
      campaign,
      recipient,
      steps,
      stepIndex: decision.stepIndex,
      depth: depth + 1,
    });
    return;
  }

  // send — expand to SMS and/or email based on campaign plan + step config
  const scheduleConfig: ScheduleConfig = {
    startDate: String(campaign.start_date ?? ymdInTimeZone(new Date(), String(campaign.timezone || "America/New_York"))),
    dailySendLimit: Number(campaign.daily_send_limit ?? 10),
    sendDays: (campaign.send_days as number[]) ?? [1, 2, 3, 4, 5],
    windowStart: String(campaign.send_window_start ?? "10:00"),
    windowEnd: String(campaign.send_window_end ?? "18:00"),
    timezone: String(campaign.timezone ?? "America/New_York"),
  };
  const step = steps[decision.stepIndex]!;
  const wave = resolveWaveChannels({
    campaignChannel,
    step,
    hasPhone: facts.hasPhone,
    hasEmail: facts.hasEmail,
  });
  const slots = buildMessageSchedule(
    wave.map((channel) => ({ recipientId: String(recipient.id), channel })),
    scheduleConfig
  );

  for (let i = 0; i < wave.length; i++) {
    await enqueueSendForRecipient({
      supabase,
      campaign,
      recipient,
      step,
      channel: wave[i]!,
      scheduledFor: slots[i]?.scheduledFor ?? new Date(),
    });
  }

  const nextAt = slots[0]?.scheduledFor ?? new Date();
  await supabase
    .from("review_request_recipients")
    .update({
      workflow_status: "in_progress",
      current_step: decision.stepIndex,
      next_action_at: nextAt.toISOString(),
      updated_at: nowIso,
    })
    .eq("id", recipient.id);
}

const SEQUENCE_IN_PROGRESS_STALE_MS = Number(
  process.env.SEQUENCE_IN_PROGRESS_STALE_MS ?? 15 * 60 * 1000
);

/**
 * Reclaim recipients stuck in_progress after a worker died mid-advance.
 * - If terminal messages exist, advance the sequence.
 * - If no active queued/sending messages, return to waiting for retry.
 * - Leave alone when messages are still in flight.
 */
async function reclaimStaleSequenceInProgress(
  supabase: ServiceClient,
  nowIso: string
): Promise<void> {
  const staleBefore = new Date(Date.now() - SEQUENCE_IN_PROGRESS_STALE_MS).toISOString();
  const { data: stuck } = await supabase
    .from("review_request_recipients")
    .select("id")
    .eq("workflow_status", "in_progress")
    .lt("updated_at", staleBefore)
    .limit(50);

  for (const row of stuck ?? []) {
    const { data: activeMsgs } = await supabase
      .from("review_request_messages")
      .select("id")
      .eq("recipient_id", row.id)
      .in("status", ["queued", "sending"])
      .limit(1);
    if (activeMsgs?.length) continue;

    const { data: terminal } = await supabase
      .from("review_request_messages")
      .select("step_key")
      .eq("recipient_id", row.id)
      .in("status", ["sent", "delivered", "clicked", "failed", "completed"])
      .order("updated_at", { ascending: false })
      .limit(1);

    if (terminal?.[0]?.step_key) {
      await tryAdvanceRecipientAfterSend({
        supabase,
        recipientId: String(row.id),
        stepKey: String(terminal[0].step_key),
      }).catch(() => undefined);
      continue;
    }

    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "waiting",
        next_action_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .eq("workflow_status", "in_progress");
  }
}

/**
 * Claim-lock waiting recipients whose next_action_at has passed, then advance.
 * Overlapping workers use CAS on workflow_status waiting → in_progress.
 */
export async function processSequenceWaits(limit = 50): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  await reclaimStaleSequenceInProgress(supabase, now);

  const { data: due } = await supabase
    .from("review_request_recipients")
    .select("id, campaign_id")
    .eq("workflow_status", "waiting")
    .lte("next_action_at", now)
    .order("next_action_at", { ascending: true })
    .limit(limit);

  if (!due?.length) return 0;

  let advanced = 0;
  for (const row of due) {
    const { data: claimed } = await supabase
      .from("review_request_recipients")
      .update({ workflow_status: "in_progress", updated_at: now })
      .eq("id", row.id)
      .eq("workflow_status", "waiting")
      .select("*")
      .maybeSingle();
    if (!claimed) continue;

    const { data: campaign } = await supabase
      .from("review_request_campaigns")
      .select("*")
      .eq("id", claimed.campaign_id)
      .in("status", ["active", "scheduled"])
      .maybeSingle();
    if (!campaign) {
      await supabase
        .from("review_request_recipients")
        .update({ workflow_status: "waiting", updated_at: now })
        .eq("id", claimed.id)
        .eq("workflow_status", "in_progress");
      continue;
    }

    const steps = normalizeSequenceSteps(
      (campaign.sequence_json as SequenceStep[] | null)?.length
        ? (campaign.sequence_json as SequenceStep[])
        : defaultReviewRequestSequence(
            (campaign.channel as "sms" | "email" | "both") || "sms"
          )
    );
    // After wait completes, advance past the wait step (or end if wait was last).
    const waitIdx = Number(claimed.current_step ?? 0);
    const waitStep = steps[waitIdx];
    const nextIdx =
      waitStep?.step_type === "wait"
        ? Math.min(waitIdx + 1, steps.length - 1)
        : waitIdx;
    try {
      await applyWorkflowFromIndex({
        supabase,
        campaign,
        recipient: claimed,
        steps,
        stepIndex: nextIdx,
      });
      advanced++;
    } catch (err) {
      logger.error("sequence_wait_advance_failed", {
        recipientId: claimed.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await supabase
        .from("review_request_recipients")
        .update({
          workflow_status: "waiting",
          next_action_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.id);
    }
  }
  return advanced;
}

/** Persist normalized steps into review_campaign_steps (replace). */
export async function persistCampaignSteps(params: {
  organizationId: string;
  businessId: string;
  campaignId: string;
  steps: SequenceStep[];
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("review_campaign_steps").delete().eq("campaign_id", params.campaignId);
  if (!params.steps.length) return;
  const rows = params.steps.map((s, i) => ({
    organization_id: params.organizationId,
    business_id: params.businessId,
    campaign_id: params.campaignId,
    step_index: i,
    step_key: s.step_key,
    step_type: s.step_type,
    config_json: s.config,
  }));
  const { error } = await supabase.from("review_campaign_steps").insert(rows);
  if (error) throw new Error(error.message);
}
