"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Mail,
  MessageSquareText,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { RepMetricCard, rep } from "@/components/reputation/rep-ui";
import { isMessagingReady, STATUS_LABELS } from "@/lib/messaging/status";
import type { MessagingProgressStep, MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { MessagingDashboard } from "./messaging-dashboard";
import {
  MessagingAlertBanner,
  MessagingPageShell,
  MessagingStatusBadge,
  SectionCard,
} from "./messaging-ui";

export function MessagingOverview({
  businessId,
  registration,
  progress,
  events,
  nextHref,
}: {
  businessId: string;
  registration: MessagingRegistration;
  progress: MessagingProgressStep[];
  events: MessagingRegistrationEvent[];
  nextHref: string;
}) {
  if (isMessagingReady(registration)) {
    return (
      <MessagingDashboard
        businessId={businessId}
        registration={registration}
        progress={progress}
        events={events}
      />
    );
  }

  const notStarted = registration.overallStatus === "not_started";
  const actionRequired = progress.some(
    (step) =>
      step.status === "action_required" ||
      step.status === "failed" ||
      step.status === "suspended"
  );

  // Product landing — do not drop inactive customers straight into the wizard.
  if (notStarted) {
    return (
      <div className={cn(rep.page, "messaging-enter")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className={rep.title}>Text Messaging</h1>
            <p className={rep.subtitle}>
              Dedicated business SMS for review requests — activate when you are ready.
            </p>
          </div>
          <Link href={nextHref} className={rep.btnPrimary}>
            Start Registration
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#B7E4CC] bg-[linear-gradient(145deg,#ECFDF3_0%,#ffffff_55%)] p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#137752] ring-1 ring-[#B7E4CC]">
            <Phone className="h-3.5 w-3.5" />
            SMS not active yet
          </div>
          <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-[#101828]">
            Text messaging is not active yet.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#486581]">
            You are currently sending review requests by email only. Activate SMS to improve
            response rates and automate review follow-ups from a dedicated local number.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={nextHref} className={rep.btnPrimary}>
              Start Registration
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/businesses/${businessId}/reputation/requests`}
              className={rep.btnSecondary}
            >
              <Mail className="h-4 w-4" />
              Keep using email requests
            </Link>
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-3">
          <SectionCard title="What you get" icon={MessageSquareText}>
            <ul className="space-y-2 text-sm text-[#344054]">
              <li>• Dedicated local business number</li>
              <li>• Carrier-compliant A2P registration</li>
              <li>• Review-request SMS with STOP / HELP</li>
            </ul>
          </SectionCard>
          <SectionCard title="How activation works" icon={ShieldCheck}>
            <ul className="space-y-2 text-sm text-[#344054]">
              <li>• Business profile and use case</li>
              <li>• Brand and campaign approval</li>
              <li>• Choose number, then go live</li>
            </ul>
          </SectionCard>
          <SectionCard title="Stay on email" icon={Mail}>
            <p className="text-sm leading-6 text-[#344054]">
              SMS is optional. Customers who only need Maps or email review requests can leave this
              inactive indefinitely and activate later.
            </p>
          </SectionCard>
        </div>

        <SectionCard title="Module areas" subtitle="Available after you activate SMS.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Overview",
              "Registration status",
              "Current number",
              "SMS usage",
              "Review request templates",
              "Message history",
              "Compliance",
              "Settings",
            ].map((label) => (
              <div
                key={label}
                className="rounded-lg border border-dashed border-[#E6EAF0] bg-[#F9FAFB] px-3 py-2.5 text-sm font-medium text-[#667085]"
              >
                {label}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  // In-progress registration — product shell with progress + continue.
  return (
    <MessagingPageShell
      title="Text Messaging"
      subtitle="Finish registration to activate your dedicated SMS number."
      currentId="business_details"
      steps={progress}
      registration={registration}
      actions={
        <Link href={nextHref} className={rep.btnPrimary}>
          {actionRequired ? "Fix and continue" : "Continue Setup"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {actionRequired ? (
        <MessagingAlertBanner tone="error" title="Action required">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                One or more registration steps need your attention. Open the status page to review
                rejection reasons and resubmit.
              </p>
              <Link href={`/businesses/${businessId}/reputation/messaging/status`} className={cn(rep.link, "mt-2")}>
                Review status →
              </Link>
            </div>
          </div>
        </MessagingAlertBanner>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        <div className="grid gap-3 sm:grid-cols-3">
          <RepMetricCard
            label="Current Setup Status"
            value={STATUS_LABELS[registration.overallStatus]}
            icon={ShieldCheck}
            hint="Customer-facing status"
          />
          <RepMetricCard
            label="Assigned Phone Number"
            value={registration.phoneNumberFriendly ?? "None"}
            icon={Phone}
            hint={
              registration.phoneNumberReserved && !registration.messagingEnabled
                ? "Reserved — texting disabled until approval"
                : "Dedicated business number"
            }
          />
          <RepMetricCard
            label="Compliance Status"
            value={
              registration.brandVerificationStatus === "approved" &&
              registration.campaignReviewStatus === "approved"
                ? "Verified"
                : "Unverified"
            }
            icon={MessageSquareText}
            hint="Profile · Brand · Campaign"
          />
        </div>

        <SectionCard title="General information" subtitle="Account fees and limits after activation.">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">Account status</dt>
              <dd>
                <MessagingStatusBadge status={registration.overallStatus} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">Monthly number fee</dt>
              <dd className="font-semibold text-[#101828]">$1.15 / mo</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">Messaging limit</dt>
              <dd className="font-semibold text-[#101828]">
                {registration.monthlySmsAllowance} SMS / month
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#667085]">Registration fee</dt>
              <dd className="font-semibold text-[#101828]">Carrier fees may apply</dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Registration progress" subtitle="Plain-language status for each compliance step.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="px-3 py-2 font-semibold">Component</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {[
                ["Business Profile", registration.businessDetailsStatus, "Secondary customer profile"],
                ["Brand Registration", registration.brandVerificationStatus, registration.brandType],
                ["Campaign Registration", registration.campaignReviewStatus, "Customer Care / Review Request"],
                ["Phone Number", registration.numberStatus, registration.phoneNumberFriendly ?? "Not selected"],
                ["Messaging", registration.messagingStatus, registration.messagingEnabled ? "Enabled" : "Disabled"],
              ].map(([label, status, note]) => (
                <tr key={String(label)}>
                  <td className="px-3 py-3 font-medium text-[#101828]">{label}</td>
                  <td className="px-3 py-3">
                    <MessagingStatusBadge status={status as MessagingRegistration["overallStatus"]} />
                  </td>
                  <td className="px-3 py-3 text-[#667085]">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </MessagingPageShell>
  );
}
