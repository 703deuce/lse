"use client";

import Link from "next/link";
import { Ban, History, Pause, Play, Send } from "lucide-react";
import { RepMetricCard, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS } from "@/lib/messaging/status";
import type { MessagingProgressStep, MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { MessagingPageShell, SectionCard } from "./messaging-ui";

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
  const remaining = Math.max(0, registration.monthlySmsAllowance - registration.monthlySmsUsed);
  const testDisabled = !registration.messagingEnabled || registration.messagingPaused;

  return (
    <MessagingPageShell
      title="Text Messaging"
      subtitle="Your review-request texting channel is active and compliance-ready."
      currentId="ready_to_text"
      steps={progress}
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
        <SectionCard title="Recent activity" subtitle="Delivery, opt-outs, and registration events.">
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
    </MessagingPageShell>
  );
}
