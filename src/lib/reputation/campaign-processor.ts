import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import {
  campaignImmediateSendEnabled,
  countSentTodayInTz,
  isWithinSendWindow,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { appendSmsOptOut } from "@/lib/reputation/phone";
import { sendTwilioSms } from "@/lib/reputation/twilio";

/** Requeue messages stuck in sending if a worker died mid-flight. */
const SENDING_STALE_MS = Number(process.env.CAMPAIGN_SENDING_STALE_MS ?? 15 * 60 * 1000);

async function reclaimStaleSending(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date
): Promise<void> {
  const staleBefore = new Date(now.getTime() - SENDING_STALE_MS).toISOString();
  await supabase
    .from("review_request_messages")
    .update({ status: "queued", updated_at: now.toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleBefore);
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

  const { data: campaigns } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .in("status", ["active", "scheduled"]);

  if (!campaigns?.length) return 0;

  let processed = 0;

  for (const campaign of campaigns) {
    if (campaign.status === "scheduled" && campaign.start_date) {
      const start = new Date(`${campaign.start_date}T00:00:00Z`);
      if (start > now) continue;
      // Conditional activate — only one worker flips scheduled → active.
      await supabase
        .from("review_request_campaigns")
        .update({ status: "active", started_at: now.toISOString() })
        .eq("id", campaign.id)
        .eq("status", "scheduled");
    }

    const config: ScheduleConfig = {
      startDate: campaign.start_date ?? now.toISOString().slice(0, 10),
      dailySendLimit: campaign.daily_send_limit,
      sendDays: campaign.send_days as number[],
      windowStart: campaign.send_window_start,
      windowEnd: campaign.send_window_end,
      timezone: campaign.timezone,
    };

    if (!isWithinSendWindow(now, config)) continue;

    const { data: sentTodayRows } = await supabase
      .from("review_request_messages")
      .select("sent_at")
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered", "clicked"])
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
      if (count === 0) {
        await supabase
          .from("review_request_campaigns")
          .update({ status: "completed", completed_at: now.toISOString() })
          .eq("id", campaign.id)
          .in("status", ["active", "scheduled"]);
      }
      continue;
    }

    const business = await getBusiness(campaign.business_id, campaign.organization_id);

    for (const msg of queued) {
      if (processed >= limit) break;

      // Atomic claim — only one worker may take a queued message.
      const claimTs = new Date().toISOString();
      const { data: claimed } = await supabase
        .from("review_request_messages")
        .update({ status: "sending", updated_at: claimTs })
        .eq("id", msg.id)
        .eq("status", "queued")
        .select("*")
        .maybeSingle();

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
          continue;
        }
      }

      let ok = false;
      let providerId: string | null = null;
      let failReason: string | null = null;

      try {
        if (claimed.channel === "sms" && recipient?.phone) {
          let body = String(claimed.message_body ?? "");
          body = appendSmsOptOut(body);
          const result = await sendTwilioSms({ toPhone: recipient.phone, body });
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
      } else {
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
      }
    }
  }

  return processed;
}
