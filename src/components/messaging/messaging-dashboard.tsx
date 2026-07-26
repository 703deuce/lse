"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Ban,
  History,
  Pause,
  Phone,
  Play,
  Send,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { RepMetricCard, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS, buildRegistrationTimeline } from "@/lib/messaging/status";
import type { MessagingProgressStep, MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import {
  MessagingPageShell,
  MessagingSuccessBanner,
  MessagingStatusBadge,
  RegistrationTimeline,
  SectionCard,
} from "./messaging-ui";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "registration", label: "Registration Status" },
  { id: "number", label: "Current Number" },
  { id: "usage", label: "SMS Usage" },
  { id: "templates", label: "Review Request Templates" },
  { id: "history", label: "Message History" },
  { id: "compliance", label: "Compliance" },
  { id: "settings", label: "Settings" },
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
  const timeline = buildRegistrationTimeline(registration);

  return (
    <MessagingPageShell
      title="Text Messaging"
      subtitle="Your review-request texting channel is active and compliance-ready."
      currentId="ready_to_text"
      steps={progress}
      hideProgress
      registration={registration}
      actions={
        <>
          <button type="button" disabled={testDisabled} className={cn(rep.btnPrimary, "disabled:opacity-50")}>
            <Send className="h-4 w-4" />
            Send test message
          </button>
          <Link href={`/businesses/${businessId}/reputation/requests`} className={rep.btnSecondary}>
            Send review requests
          </Link>
        </>
      }
    >
      <MessagingSuccessBanner phoneNumber={registration.phoneNumberFriendly} />

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
            <SectionCard title="SMS usage" subtitle="Plan allowance and recent outbound volume.">
              <UsageBar used={registration.monthlySmsUsed} allowance={registration.monthlySmsAllowance} />
            </SectionCard>

            <SectionCard title="Quick actions" subtitle="Everyday messaging controls.">
              <div className="space-y-2">
                <button
                  type="button"
                  className={cn(rep.btnSecondary, "w-full")}
                  onClick={() => setTab("registration")}
                >
                  <History className="h-4 w-4" />
                  Registration status
                </button>
                <button
                  type="button"
                  className={cn(rep.btnSecondary, "w-full")}
                  onClick={() => setTab("number")}
                >
                  <Phone className="h-4 w-4" />
                  Current number
                </button>
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
        </>
      ) : null}

      {tab === "registration" ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard title="Registration status" subtitle="Where this account sits in carrier review." icon={ShieldCheck}>
            <RegistrationTimeline items={timeline} />
            <Link
              href={`/businesses/${businessId}/reputation/messaging/status`}
              className={cn(rep.btnSecondary, "mt-4")}
            >
              Open full status page
            </Link>
          </SectionCard>
          <SectionCard title="Component statuses">
            <ul className="space-y-3">
              {(
                [
                  ["Business profile", registration.businessDetailsStatus],
                  ["Brand", registration.brandVerificationStatus],
                  ["Campaign", registration.campaignReviewStatus],
                  ["Number", registration.numberStatus],
                  ["Messaging", registration.messagingStatus],
                ] as const
              ).map(([label, status]) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#344054]">{label}</span>
                  <MessagingStatusBadge status={status} />
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      {tab === "number" ? (
        <SectionCard title="Current number" subtitle="Dedicated local number for outbound review requests." icon={Phone}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] pb-3">
              <dt className="text-[#667085]">Phone number</dt>
              <dd className="text-lg font-bold text-[#101828]">
                {registration.phoneNumberFriendly ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] pb-3">
              <dt className="text-[#667085]">Locality</dt>
              <dd className="font-semibold text-[#101828]">
                {[registration.phoneNumberLocality, registration.phoneNumberRegion]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] pb-3">
              <dt className="text-[#667085]">Monthly cost</dt>
              <dd className="font-semibold text-[#101828]">
                {registration.phoneNumberMonthlyCost != null
                  ? `$${registration.phoneNumberMonthlyCost.toFixed(2)}`
                  : "$1.15"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">Capabilities</dt>
              <dd className="font-semibold text-[#101828]">
                {[
                  registration.phoneNumberCapabilities?.sms && "SMS",
                  registration.phoneNumberCapabilities?.mms && "MMS",
                  registration.phoneNumberCapabilities?.voice && "Voice",
                ]
                  .filter(Boolean)
                  .join(" · ") || "SMS"}
              </dd>
            </div>
          </dl>
          <Link
            href={`/businesses/${businessId}/reputation/messaging/number`}
            className={cn(rep.btnSecondary, "mt-4")}
          >
            Replace or release number
          </Link>
        </SectionCard>
      ) : null}

      {tab === "usage" ? (
        <SectionCard title="SMS usage" subtitle="Track allowance against outbound volume.">
          <UsageBar used={registration.monthlySmsUsed} allowance={registration.monthlySmsAllowance} />
          <p className="mt-4 text-sm text-[#667085]">{remaining} messages remaining this month.</p>
        </SectionCard>
      ) : null}

      {tab === "templates" ? (
        <SectionCard
          title="Review request templates"
          subtitle="Manage SMS templates used for post-job follow-ups."
        >
          <p className="text-sm text-[#667085]">
            Edit merge fields, sample copy, and review-request sequences in Templates.
          </p>
          <Link href={`/businesses/${businessId}/reputation/templates`} className={cn(rep.btnPrimary, "mt-4")}>
            Open templates
          </Link>
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

      {tab === "compliance" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <SectionCard title="Compliance" subtitle="Consent, STOP, and HELP language on file." icon={ShieldCheck}>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Opt-in method</dt>
                <dd className="mt-1 text-[#101828]">{registration.useCase.optInMethod || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">STOP wording</dt>
                <dd className="mt-1 text-[#101828]">{registration.useCase.optOutWording || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">HELP wording</dt>
                <dd className="mt-1 text-[#101828]">{registration.useCase.helpWording || "—"}</dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard title="Opt-outs" subtitle="Contacts who replied STOP.">
            <p className="text-sm text-[#667085]">
              Manage SMS opt-outs from your contacts list. Opted-out numbers are blocked from future
              review-request texts.
            </p>
            <Link href={`/businesses/${businessId}/reputation/contacts`} className={cn(rep.btnSecondary, "mt-4")}>
              <Ban className="h-4 w-4" />
              View opt-outs
            </Link>
          </SectionCard>
          <SectionCard title="Recent registration activity" className="lg:col-span-2">
            {events.length === 0 ? (
              <p className="text-sm text-[#667085]">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.slice(0, 8).map((event) => (
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
        </div>
      ) : null}

      {tab === "settings" ? (
        <SectionCard title="Messaging settings" subtitle="Number, pause controls, and compliance links." icon={Settings2}>
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
            <button type="button" className={rep.btnSecondary}>
              {registration.messagingPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {registration.messagingPaused ? "Resume texting" : "Pause texting"}
            </button>
            <Link href={`/businesses/${businessId}/reputation/messaging/number`} className={rep.btnSecondary}>
              Manage number
            </Link>
            <Link href={`/businesses/${businessId}/reputation/messaging/status`} className={rep.btnSecondary}>
              Compliance registration
            </Link>
          </div>
        </SectionCard>
      ) : null}
    </MessagingPageShell>
  );
}
