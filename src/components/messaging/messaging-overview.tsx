"use client";

import Link from "next/link";
import { AlertTriangle, MessageSquareText, Phone, ShieldCheck } from "lucide-react";
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

  const actionRequired = progress.some(
    (step) =>
      step.status === "action_required" ||
      step.status === "failed" ||
      step.status === "suspended"
  );

  return (
    <MessagingPageShell
      title="Text Messaging Setup"
      subtitle="Register your business for compliant review-request texting. One Twilio subaccount per customer."
      currentId="business_details"
      steps={progress}
      registration={registration}
      actions={
        <Link href={nextHref} className={rep.btnPrimary}>
          {registration.overallStatus === "not_started" ? "Start Registration" : "Continue Setup"}
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

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard title="Why register?" subtitle="Carrier-compliant A2P messaging for review requests.">
          <ul className="space-y-2 text-sm text-[#344054]">
            <li>• Higher delivery rates and fewer spam filters</li>
            <li>• Separate Twilio subaccount per customer</li>
            <li>• Clear consent, STOP, and HELP language</li>
          </ul>
        </SectionCard>
        <SectionCard title="Estimated timelines" subtitle="Approvals vary with registry volume.">
          <ul className="space-y-2 text-sm text-[#344054]">
            <li>• Business profile: often minutes to hours</li>
            <li>• Brand registration: minutes to 1 day</li>
            <li>• Campaign review: commonly 1–2 weeks</li>
          </ul>
        </SectionCard>
        <SectionCard title="Fees and pricing" subtitle="Carrier and number fees apply after go-live.">
          <ul className="space-y-2 text-sm text-[#344054]">
            <li>• Dedicated local number: ~$1.15/mo</li>
            <li>• Campaign / brand registry fees may apply</li>
            <li>• Plan SMS allowance tracked after activation</li>
          </ul>
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
