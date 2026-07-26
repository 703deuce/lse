"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, History, Pause, Play, Send } from "lucide-react";
import { RepMetricCard, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS } from "@/lib/messaging/status";
import type { MessagingProgressStep, MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { MessagingPageShell, SectionCard } from "./messaging-ui";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "templates", label: "Review Request Templates" },
  { id: "settings", label: "Settings" },
  { id: "history", label: "Message History" },
] as const;

const SAMPLE_MESSAGES = [
  {
    id: "msg-1",
    to: "(703) 555-0142",
    body: "Hi Jordan, thanks for choosing Long Home. We'd appreciate your feedback: https://reviews.example/lh. Reply STOP to opt out.",
    status: "Delivered",
    sentAt: "2026-07-24T15:12:00.000Z",
  },
  {
    id: "msg-2",
    to: "(571) 555-0198",
    body: "Hi Sam, just checking in after your project. Leave a quick review: https://reviews.example/lh. Reply STOP to opt out.",
    status: "Delivered",
    sentAt: "2026-07-22T18:40:00.000Z",
  },
  {
    id: "msg-3",
    to: "(202) 555-0177",
    body: "Hi Casey, thanks again for trusting Long Home. Share your experience: https://reviews.example/lh. Reply STOP to opt out.",
    status: "Queued",
    sentAt: "2026-07-21T12:05:00.000Z",
  },
] as const;

function UsageBar({ used, allowance }: { used: number; allowance: number }) {
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className={rep.label}>Monthly usage</p>
          <p className="mt-1 text-2xl font-bold text-[#101828]">
            {used}
            <span className="text-base font-semibold text-[#98A2B3]"> / {allowance}</span>
          </p>
        </div>
        <p className="text-sm font-semibold text-[#137752]">{pct}% used</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#F2F4F7]">
        <div
          className="h-full rounded-full bg-[#137752] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, index) => {
          const height = [42, 58, 35, 72, 64, 48, Math.max(20, pct)][index];
          return (
            <div key={index} className="flex h-20 items-end rounded-md bg-[#F9FAFB] px-1 pb-1">
              <div
                className="w-full rounded-sm bg-[#B7E4CC]"
                style={{ height: `${height}%` }}
                title={`Day ${index + 1}`}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[#98A2B3]">Last 7 days · outbound review-request volume</p>
    </div>
  );
}

export function MessagingDashboard({
  businessId,
  registration,
  progress,
  events,
}: {
  businessId: string;
  registration: MessagingRegistration;
  progress: MessagingProgressStep[];
  events: MessagingRegistrationEvent[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const remaining = Math.max(0, registration.monthlySmsAllowance - registration.monthlySmsUsed);
  const testDisabled = !registration.messagingEnabled || registration.messagingPaused;

  return (
    <MessagingPageShell
      title="Text Messaging"
      subtitle="Your review-request texting channel is active and compliance-ready."
      currentId="ready_to_text"
      steps={progress}
      hideProgress
      actions={
        <>
          <button type="button" disabled={testDisabled} className={cn(rep.btnPrimary, "disabled:opacity-50")}>
            <Send className="h-4 w-4" />
            Send test message
          </button>
          <Link href={`/businesses/${businessId}/reputation/templates`} className={rep.btnSecondary}>
            Review-request templates
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap gap-1 border-b border-[#E6EAF0]">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-semibold transition",
              tab === item.id ? rep.tabActive : rep.tabIdle
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <RepMetricCard label="Phone number" value={registration.phoneNumberFriendly ?? "—"} hint="Dedicated number" />
            <RepMetricCard
              label="Registration"
              value={STATUS_LABELS[registration.overallStatus]}
              hint="Profile · Brand · Campaign"
            />
            <RepMetricCard
              label="Text messaging"
              value={registration.messagingPaused ? "Paused" : "Active"}
              hint={registration.useCase.campaignUseCase.replaceAll("_", " ")}
            />
            <RepMetricCard
              label="Monthly SMS"
              value={`${registration.monthlySmsUsed}/${registration.monthlySmsAllowance}`}
              hint={`${remaining} remaining`}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SectionCard title="Usage" subtitle="Plan allowance and recent outbound volume.">
              <UsageBar used={registration.monthlySmsUsed} allowance={registration.monthlySmsAllowance} />
            </SectionCard>

            <SectionCard title="Manage" subtitle="Compliance and number controls.">
              <div className="space-y-2">
                <Link href={`/businesses/${businessId}/reputation/messaging/status`} className={cn(rep.btnSecondary, "w-full")}>
                  <History className="h-4 w-4" />
                  View compliance registration
                </Link>
                <Link href={`/businesses/${businessId}/reputation/messaging/number`} className={cn(rep.btnSecondary, "w-full")}>
                  Replace or release number
                </Link>
                <button type="button" className={cn(rep.btnSecondary, "w-full")}>
                  {registration.messagingPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {registration.messagingPaused ? "Resume texting" : "Pause texting"}
                </button>
                <Link href={`/businesses/${businessId}/reputation/contacts`} className={cn(rep.btnSecondary, "w-full")}>
                  <Ban className="h-4 w-4" />
                  View opt-outs
                </Link>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Recent registration activity" subtitle="Delivery, opt-outs, and registration events.">
            {events.length === 0 ? (
              <p className="text-sm text-[#667085]">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.slice(0, 6).map((event) => (
                  <li key={event.id} className="rounded-lg bg-[#F9FAFB] px-3 py-2">
                    <p className="text-sm font-medium text-[#101828]">{event.message ?? event.eventType}</p>
                    <p className="mt-1 text-xs text-[#98A2B3]">
                      {new Date(event.createdAt).toLocaleString()} · {event.source}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : null}

      {tab === "templates" ? (
        <SectionCard
          title="Review request templates"
          subtitle="Manage SMS templates used for post-job follow-ups."
        >
          <p className="text-sm text-[#667085]">
            Open the Templates area to edit merge fields, sample copy, and review-request sequences.
          </p>
          <Link href={`/businesses/${businessId}/reputation/templates`} className={cn(rep.btnPrimary, "mt-4")}>
            Open templates
          </Link>
        </SectionCard>
      ) : null}

      {tab === "settings" ? (
        <SectionCard title="Messaging settings" subtitle="Number, pause controls, and compliance links.">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] pb-3">
              <dt className="text-[#667085]">Dedicated number</dt>
              <dd className="font-semibold text-[#101828]">{registration.phoneNumberFriendly ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] pb-3">
              <dt className="text-[#667085]">Messaging status</dt>
              <dd className="font-semibold text-[#101828]">
                {registration.messagingPaused ? "Paused" : "Active"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">Monthly allowance</dt>
              <dd className="font-semibold text-[#101828]">{registration.monthlySmsAllowance} SMS</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/businesses/${businessId}/reputation/messaging/status`} className={rep.btnSecondary}>
              Compliance registration
            </Link>
            <Link href={`/businesses/${businessId}/reputation/messaging/number`} className={rep.btnSecondary}>
              Manage number
            </Link>
          </div>
        </SectionCard>
      ) : null}

      {tab === "history" ? (
        <SectionCard title="Message history" subtitle="Recent outbound review-request messages.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                <tr>
                  <th className="px-3 py-2 font-semibold">To</th>
                  <th className="px-3 py-2 font-semibold">Message</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {SAMPLE_MESSAGES.map((message) => (
                  <tr key={message.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-[#101828]">{message.to}</td>
                    <td className="max-w-xl px-3 py-3 text-[#667085]">{message.body}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          message.status === "Delivered"
                            ? "bg-[#ECFDF3] text-[#027A48]"
                            : "bg-[#FFFAEB] text-[#B54708]"
                        )}
                      >
                        {message.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[#98A2B3]">
                      {new Date(message.sentAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </MessagingPageShell>
  );
}
