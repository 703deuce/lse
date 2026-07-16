import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { isBillingHealthy, hasEntitlement } from "@/lib/auth/entitlements";
import { PlanLimitError, releaseUsage, reserveUsage } from "@/lib/plans";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import { buildInboundReplyAddress } from "@/lib/reputation/inbound-reply";
import { buildUnsubscribeUrl } from "@/lib/reputation/unsubscribe";
import {
  campaignImmediateSendEnabled,
  countSentTodayInTz,
  isOnOrAfterStartDate,
  isWithinSendWindow,
  ymdInTimeZone,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { appendSmsOptOut } from "@/lib/reputation/phone";
import { sendTwilioSms } from "@/lib/reputation/twilio";
import { logger } from "@/lib/observability/logger";
import { claimQueuedCampaignMessage } from "@/lib/reputation/campaign-claim";
import {
  processSequenceWaits,
  tryAdvanceRecipientAfterSend,
} from "@/lib/reputation/sequence-runner";
import { attributeRecentReviewsForBusiness } from "@/lib/reputation/attribution";

/** Requeue messages stuck in sending if a worker died mid-flight. */
const SENDING_STALE_MS = Number(process.env.CAMPAIGN_SENDING_STALE_MS ?? 15 * 60 * 1000);

async function reclaimStaleSending(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date
): Promise<void> {
  const staleBefore = new Date(now.getTime() - SENDING_STALE_MS).toISOString();

  // Provider succeeded but DB never flipped to sent — mark sent instead of requeueing
  // (avoids double-send).
  await supabase
    .from("review_request_messages")
    .update({ status: "sent", sent_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleBefore)
    .not("provider_message_id", "is", null);

  // Truly abandoned mid-flight with no provider confirmation — safe to retry.
  await supabase
    .from("review_request_messages")
    .update({ status: "queued", updated_at: now.toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleBefore)
    .is("provider_message_id", null);
}

/**
 * Process queued campaign messages.
 * Each message is claim-locked queued → sending before Twilio/Brevo, so parallel
 * pollers cannot double-send the same row.
 */
export async function processCampaignMessages(limit = 20): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date();

  await reclaimStaleSending(supabase, now);

  // Advance wait/condition/reminder steps (CAS-locked per recipient).
  await processSequenceWaits(Math.min(50, limit * 2));

  const { data: campaigns } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .in("status", ["active", "scheduled"]);

  if (!campaigns?.length) return 0;

  let processed = 0;

  for (const campaign of campaigns) {
    // Billing / add-on guard — pause outbound rather than send while ineligible.
    if (!(await hasEntitlement(campaign.organization_id, "review_campaigns"))) {
      continue;
    }
    if (!(await isBillingHealthy(campaign.organization_id))) {
      await supabase
        .from("review_request_campaigns")
        .update({
          status: "paused",
          auto_pause_reason: "billing_inactive",
          updated_at: now.toISOString(),
        })
        .eq("id", campaign.id)
        .in("status", ["active", "scheduled"]);
      continue;
    }

    if (campaign.status === "scheduled" && campaign.start_date) {
      const tz = (campaign.timezone as string) || "America/New_York";
      if (!isOnOrAfterStartDate(now, String(campaign.start_date), tz)) continue;
      // Conditional activate — only one worker flips scheduled → active.
      await supabase
        .from("review_request_campaigns")
        .update({ status: "active", started_at: now.toISOString() })
        .eq("id", campaign.id)
        .eq("status", "scheduled");
    }

    const config: ScheduleConfig = {
      startDate: campaign.start_date ?? ymdInTimeZone(now, (campaign.timezone as string) || "America/New_York"),
      dailySendLimit: campaign.daily_send_limit,
      sendDays: campaign.send_days as number[],
      windowStart: campaign.send_window_start,
      windowEnd: campaign.send_window_end,
      timezone: campaign.timezone,
    };

    if (!isWithinSendWindow(now, config)) continue;

    // Bound by recent window so PostgREST row caps can't undercount today's sends.
    const sentSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: sentTodayRows } = await supabase
      .from("review_request_messages")
      .select("sent_at")
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered", "clicked"])
      .gte("sent_at", sentSince)
      .not("sent_at", "is", null);

    // Count in-flight claims against the daily cap too (no sent_at yet).
    const { count: sendingCount } = await supabase
      .from("review_request_messages")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "sending");

    const sentToday =
      countSentTodayInTz(
        (sentTodayRows ?? []).map((r) => r.sent_at as string),
        campaign.timezone,
        now
      ) + (sendingCount ?? 0);
    const remaining = campaignImmediateSendEnabled()
      ? limit
      : Math.max(0, campaign.daily_send_limit - sentToday);
    if (!campaignImmediateSendEnabled() && remaining <= 0) continue;

    let queuedQuery = supabase
      .from("review_request_messages")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("scheduled_for", { ascending: true })
      .limit(campaignImmediateSendEnabled() ? limit : remaining);

    if (!campaignImmediateSendEnabled()) {
      queuedQuery = queuedQuery.lte("scheduled_for", now.toISOString());
    }

    const { data: queued } = await queuedQuery;

    if (!queued?.length) {
      const { count } = await supabase
        .from("review_request_messages")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .in("status", ["queued", "sending"]);
      const { count: waitingCount } = await supabase
        .from("review_request_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .in("workflow_status", ["waiting", "in_progress", "scheduled"]);
      // Keep campaigns wired to Automatic Review Triggers alive for future enrollments.
      const { count: triggerLinks } = await supabase
        .from("integration_webhook_endpoints")
        .select("id", { count: "exact", head: true })
        .or(`campaign_id.eq.${campaign.id},default_campaign_id.eq.${campaign.id}`)
        .eq("is_active", true)
        .is("revoked_at", null);
      if (count === 0 && (waitingCount ?? 0) === 0 && (triggerLinks ?? 0) === 0) {
        await supabase
          .from("review_request_campaigns")
          .update({ status: "completed", completed_at: now.toISOString() })
          .eq("id", campaign.id)
          .in("status", ["active", "scheduled"]);
      } else if (count === 0 && (waitingCount ?? 0) === 0 && (triggerLinks ?? 0) > 0) {
        // Evergreen trigger target — stay active; still attribute recent reviews.
        await attributeRecentReviewsForBusiness({
          businessId: campaign.business_id,
          organizationId: campaign.organization_id,
          campaignId: campaign.id,
        }).catch(() => undefined);
      } else {
        // Soft attribution pass while campaign is still live.
        await attributeRecentReviewsForBusiness({
          businessId: campaign.business_id,
          organizationId: campaign.organization_id,
          campaignId: campaign.id,
        }).catch(() => undefined);
      }
      continue;
    }

    const business = await getBusiness(campaign.business_id, campaign.organization_id);

    for (const msg of queued) {
      if (processed >= limit) break;

      // Atomic claim — only one worker may take a queued message.
      const claimTs = new Date().toISOString();
      const claimed = await claimQueuedCampaignMessage(
        supabase as unknown as Parameters<typeof claimQueuedCampaignMessage>[0],
        msg.id,
        claimTs
      );

      if (!claimed) continue;

      const { data: recipient } = await supabase
        .from("review_request_recipients")
        .select("phone, email, first_name, full_name")
        .eq("id", claimed.recipient_id)
        .maybeSingle();

      if (recipient?.phone || recipient?.email) {
        const channel = String(claimed.channel ?? "");
        let suppressed = false;
        if ((channel === "sms" || channel === "both" || !channel) && recipient.phone) {
          const { data } = await supabase
            .from("review_request_suppression")
            .select("id")
            .eq("business_id", campaign.business_id)
            .eq("phone", recipient.phone)
            .limit(1);
          suppressed = Boolean(data?.length);
        }
        if (!suppressed && (channel === "email" || channel === "both" || !channel) && recipient.email) {
          const { data } = await supabase
            .from("review_request_suppression")
            .select("id")
            .eq("business_id", campaign.business_id)
            .eq("email", recipient.email.toLowerCase())
            .limit(1);
          suppressed = Boolean(data?.length);
        }
        if (suppressed) {
          await supabase
            .from("review_request_messages")
            .update({ status: "opted_out", updated_at: claimTs })
            .eq("id", claimed.id)
            .eq("status", "sending");
          await supabase
            .from("review_request_recipients")
            .update({
              workflow_status: "opted_out",
              next_action_at: null,
              updated_at: claimTs,
            })
            .eq("id", claimed.recipient_id);
          continue;
        }
      }

      // Reserve usage BEFORE provider send so we never deliver then requeue.
      const usageKey = claimed.channel === "sms" ? "review_sms_sent" : "review_emails_sent";
      try {
        await reserveUsage(campaign.organization_id, usageKey, 1, { enforceLimit: true });
      } catch (err) {
        if (err instanceof PlanLimitError) {
          await supabase
            .from("review_request_messages")
            .update({ status: "queued", updated_at: claimTs })
            .eq("id", claimed.id)
            .eq("status", "sending");
          await supabase
            .from("review_request_campaigns")
            .update({
              status: "paused",
              auto_pause_reason: `plan_limit:${err.limitKey}`,
              updated_at: claimTs,
            })
            .eq("id", campaign.id)
            .eq("status", "active");
          logger.warn("campaign_paused_plan_limit", {
            campaignId: campaign.id,
            businessId: campaign.business_id,
            limitKey: err.limitKey,
          });
          break;
        }
        throw err;
      }

      let ok = false;
      let providerId: string | null = null;
      let failReason: string | null = null;

      try {
        if (claimed.channel === "sms" && recipient?.phone) {
          let body = String(claimed.message_body ?? "");
          body = appendSmsOptOut(body);
          const result = await sendTwilioSms({
            toPhone: recipient.phone,
            body,
            organizationId: String(campaign.organization_id ?? claimed.organization_id ?? ""),
            businessId: String(campaign.business_id ?? claimed.business_id ?? ""),
          });
          ok = result.ok;
          if (result.ok) providerId = result.messageSid;
          else failReason = result.error;
        } else if (claimed.channel === "email" && recipient?.email) {
          const result = await sendBrevoEmail({
            toEmail: recipient.email,
            toName: recipient.full_name ?? recipient.first_name ?? undefined,
            fromName: business?.name,
            subject: String(claimed.subject ?? `Feedback for ${business?.name ?? "us"}`),
            textBody: String(claimed.message_body ?? ""),
            replyToEmail: buildInboundReplyAddress(String(claimed.id)),
            listUnsubscribeUrl: buildUnsubscribeUrl(String(claimed.id)),
            organizationId: String(campaign.organization_id ?? claimed.organization_id ?? ""),
            businessId: String(campaign.business_id ?? claimed.business_id ?? ""),
          });
          ok = result.ok;
          if (result.ok) providerId = result.messageId;
          else failReason = result.error;
        } else {
          failReason = "Missing recipient contact for channel";
        }
      } catch (e) {
        failReason = e instanceof Error ? e.message : "Send failed";
      }

      // Persist provider id immediately so a crash before status=sent cannot reclaim→resend.
      if (ok && providerId) {
        await supabase
          .from("review_request_messages")
          .update({ provider_message_id: providerId, updated_at: new Date().toISOString() })
          .eq("id", claimed.id)
          .eq("status", "sending");
      }

      const ts = new Date().toISOString();
      if (ok) {
        await supabase
          .from("review_request_messages")
          .update({
            status: "sent",
            sent_at: ts,
            provider_message_id: providerId,
            updated_at: ts,
          })
          .eq("id", claimed.id)
          .eq("status", "sending");
        processed++;
        logger.info("campaign_message_sent", {
          campaignId: campaign.id,
          businessId: campaign.business_id,
          recipientId: claimed.recipient_id,
          messageId: claimed.id,
          channel: claimed.channel,
          provider: claimed.channel === "sms" ? "twilio" : "brevo",
        });
        const stepKey = String(claimed.step_key ?? "initial");
        await tryAdvanceRecipientAfterSend({
          supabase,
          recipientId: String(claimed.recipient_id),
          stepKey,
        }).catch((err) => {
          logger.warn("sequence_advance_after_send_failed", {
            messageId: claimed.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      } else {
        // Release reserved usage on provider failure so limits stay honest.
        await releaseUsage(campaign.organization_id, usageKey, 1).catch(() => undefined);
        await supabase
          .from("review_request_messages")
          .update({
            status: "failed",
            failed_at: ts,
            failed_reason: failReason,
            updated_at: ts,
          })
          .eq("id", claimed.id)
          .eq("status", "sending");
        const stepKey = String(claimed.step_key ?? "initial");
        await tryAdvanceRecipientAfterSend({
          supabase,
          recipientId: String(claimed.recipient_id),
          stepKey,
        }).catch(() => undefined);
      }
    }
  }

  return processed;
}
