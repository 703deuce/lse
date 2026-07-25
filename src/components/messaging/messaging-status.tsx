"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { rep } from "@/components/reputation/rep-ui";
import type { MessagingProgressStep, MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { MessagingPageShell, MessagingStatusBadge, SectionCard } from "./messaging-ui";

export function MessagingStatusScreen({
  businessId,
  registration,
  progress,
  events,
  onRefresh,
  saving,
  error,
}: {
  businessId: string;
  registration: MessagingRegistration;
  progress: MessagingProgressStep[];
  events: MessagingRegistrationEvent[];
  onRefresh: () => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const failed =
    registration.businessDetailsStatus === "failed" ||
    registration.brandVerificationStatus === "failed" ||
    registration.campaignReviewStatus === "failed";

  const components = [
    {
      label: "Business Profile",
      status: registration.businessDetailsStatus,
      detail: registration.twilio.profileFailureReasons.join("; ") || "Secondary customer profile",
    },
    {
      label: "Brand Registration",
      status: registration.brandVerificationStatus,
      detail: registration.twilio.brandFailureReason || `${registration.brandType} · email ${registration.brandEmailVerificationStatus}`,
    },
    {
      label: "Campaign Registration",
      status: registration.campaignReviewStatus,
      detail: registration.twilio.campaignFailureReason || "Customer Care / Review Requests",
    },
    {
      label: "Phone Number",
      status: registration.numberStatus,
      detail: registration.phoneNumberFriendly ?? "Not selected",
    },
    {
      label: "Messaging",
      status: registration.messagingStatus,
      detail: registration.messagingEnabled ? "Enabled" : "Disabled until full approval",
    },
  ] as const;

  return (
    <MessagingPageShell
      title="Registration status"
      subtitle="Track business verification, brand, campaign, number, and messaging readiness in one place."
      steps={progress}
      currentId="brand_verification"
      actions={
        <button type="button" disabled={saving} className={rep.btnSecondary} onClick={() => void onRefresh()}>
          <RefreshCw className="h-4 w-4" />
          {saving ? "Checking..." : "Check for updates"}
        </button>
      }
    >
      {failed ? (
        <div className="rounded-xl border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">
          <p className="font-semibold">Why was this rejected?</p>
          <p className="mt-1">
            {registration.twilio.profileFailureReasons.join("; ") ||
              registration.twilio.brandFailureReason ||
              registration.twilio.campaignFailureReason ||
              "Twilio reported a failure. Edit the affected fields and resubmit."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/businesses/${businessId}/reputation/messaging/business`} className={rep.btnSecondary}>
              Edit application
            </Link>
            <Link href={`/businesses/${businessId}/reputation/messaging/review`} className={rep.btnPrimary}>
              Resubmit
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="Component status" subtitle="Internal Twilio statuses are mapped to plain language.">
          <ul className="space-y-3">
            {components.map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-[#E6EAF0] px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#101828]">{item.label}</p>
                  <p className="mt-1 text-sm text-[#667085]">{item.detail}</p>
                </div>
                <MessagingStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 text-sm text-[#667085] sm:grid-cols-2">
            <p>Submitted: {registration.submittedAt ? new Date(registration.submittedAt).toLocaleString() : "Not submitted"}</p>
            <p>
              Last checked:{" "}
              {registration.lastStatusCheckedAt
                ? new Date(registration.lastStatusCheckedAt).toLocaleString()
                : "—"}
            </p>
            <p>Brand email verification: {registration.brandEmailVerificationStatus}</p>
            <p>Estimated campaign review: commonly 10–15 days during high volume</p>
          </div>
        </SectionCard>

        <SectionCard title="Submission history">
          {events.length === 0 ? (
            <p className="text-sm text-[#667085]">No status events yet.</p>
          ) : (
            <ul className="space-y-3">
              {events.slice(0, 12).map((event) => (
                <li key={event.id}>
                  <p className="text-sm font-medium text-[#101828]">{event.message ?? event.eventType}</p>
                  <p className="text-xs text-[#98A2B3]">{new Date(event.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Link href={`/businesses/${businessId}/reputation/messaging/number`} className={rep.btnPrimary}>
          Choose phone number
        </Link>
        <Link href={`/businesses/${businessId}/reputation/messaging`} className={rep.btnSecondary}>
          Back to overview
        </Link>
      </div>
    </MessagingPageShell>
  );
}
