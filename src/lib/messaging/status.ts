import type { CustomerFacingStatus, MessagingProgressStep, MessagingRegistration } from "./types";

export const STATUS_LABELS: Record<CustomerFacingStatus, string> = {
  not_started: "Not started",
  action_required: "Action required",
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  failed: "Failed",
  suspended: "Suspended",
  ready: "Ready",
};

export function statusTone(
  status: CustomerFacingStatus
): "green" | "amber" | "red" | "gray" | "blue" {
  if (status === "approved" || status === "ready") return "green";
  if (status === "in_review" || status === "submitted") return "amber";
  if (status === "failed" || status === "suspended" || status === "action_required") return "red";
  if (status === "not_started") return "gray";
  return "blue";
}

export function mapTwilioStatus(raw: string | null | undefined): CustomerFacingStatus {
  const value = (raw ?? "").toUpperCase();
  if (!value || value === "DRAFT") return "not_started";
  if (value.includes("PENDING") || value === "IN_REVIEW" || value === "PENDING_REVIEW") {
    return "in_review";
  }
  if (value === "APPROVED" || value === "TWILIO_APPROVED" || value === "VERIFIED") {
    return "approved";
  }
  if (value === "FAILED" || value === "REJECTED") return "failed";
  if (value === "SUSPENDED") return "suspended";
  if (value === "ACTION_REQUIRED" || value === "TWILIO_REJECTED") return "action_required";
  return "submitted";
}

export function buildProgressSteps(
  registration: MessagingRegistration,
  businessId: string
): MessagingProgressStep[] {
  const base = `/businesses/${businessId}/reputation/messaging`;
  return [
    {
      id: "business_details",
      label: "Business details",
      status: registration.businessDetailsStatus,
      href: `${base}/business`,
    },
    {
      id: "messaging_use_case",
      label: "Messaging use case",
      status: registration.useCaseStatus,
      href: `${base}/use-case`,
    },
    {
      id: "brand_verification",
      label: "Brand verification",
      status: registration.brandVerificationStatus,
      href: `${base}/status`,
    },
    {
      id: "campaign_review",
      label: "Campaign review",
      status: registration.campaignReviewStatus,
      href: `${base}/status`,
    },
    {
      id: "choose_number",
      label: "Choose number",
      status: registration.numberStatus,
      href: `${base}/number`,
    },
    {
      id: "ready_to_text",
      label: "Ready to text",
      status: registration.messagingStatus,
      href: base,
    },
  ];
}

export function isMessagingReady(registration: MessagingRegistration): boolean {
  return (
    registration.messagingEnabled &&
    registration.overallStatus === "ready" &&
    Boolean(registration.phoneNumberE164)
  );
}

export function nextSetupHref(registration: MessagingRegistration, businessId: string): string {
  const base = `/businesses/${businessId}/reputation/messaging`;
  if (registration.businessDetailsStatus === "not_started" || registration.businessDetailsStatus === "action_required") {
    return `${base}/business`;
  }
  if (registration.useCaseStatus === "not_started" || registration.useCaseStatus === "action_required") {
    return `${base}/use-case`;
  }
  if (!registration.submittedAt) return `${base}/review`;
  if (
    registration.brandVerificationStatus === "failed" ||
    registration.campaignReviewStatus === "failed" ||
    registration.businessDetailsStatus === "failed"
  ) {
    return `${base}/status`;
  }
  if (registration.numberStatus === "not_started") return `${base}/number`;
  if (isMessagingReady(registration)) return base;
  return `${base}/status`;
}
