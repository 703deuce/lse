import type {
  CustomerFacingStatus,
  MessagingProgressStep,
  MessagingRegistration,
  MessagingTimelineItem,
  ProgressStepId,
} from "./types";

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

function isStarted(status: CustomerFacingStatus): boolean {
  return status !== "not_started";
}

function isDone(status: CustomerFacingStatus): boolean {
  return status === "approved" || status === "ready";
}

export function isStepAvailable(
  registration: MessagingRegistration,
  stepId: ProgressStepId
): boolean {
  switch (stepId) {
    case "business_details":
      return true;
    case "messaging_use_case":
      return isStarted(registration.businessDetailsStatus);
    case "brand_verification":
    case "campaign_review":
      return Boolean(registration.submittedAt) || isStarted(registration.useCaseStatus);
    case "choose_number":
      return Boolean(registration.submittedAt) || registration.campaignReviewStatus === "approved";
    case "ready_to_text":
      return (
        Boolean(registration.phoneNumberE164) ||
        registration.messagingStatus === "ready" ||
        isMessagingReady(registration)
      );
    default:
      return false;
  }
}

/** Weighted completion across the six setup steps (0–100). */
export function registrationCompletionPercent(registration: MessagingRegistration): number {
  const statuses = [
    registration.businessDetailsStatus,
    registration.useCaseStatus,
    registration.brandVerificationStatus,
    registration.campaignReviewStatus,
    registration.numberStatus,
    registration.messagingStatus,
  ];
  const score = statuses.reduce((sum, status) => {
    if (status === "approved" || status === "ready") return sum + 1;
    if (status === "submitted" || status === "in_review") return sum + 0.7;
    if (status === "action_required") return sum + 0.35;
    return sum;
  }, 0);
  return Math.round((score / statuses.length) * 100);
}

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
  const steps: MessagingProgressStep[] = [
    {
      id: "business_details",
      label: "Business details",
      status: registration.businessDetailsStatus,
      href: `${base}/business`,
      available: true,
    },
    {
      id: "messaging_use_case",
      label: "Messaging use case",
      status: registration.useCaseStatus,
      href: `${base}/use-case`,
      available: false,
    },
    {
      id: "brand_verification",
      label: "Brand verification",
      status: registration.brandVerificationStatus,
      href: registration.submittedAt ? `${base}/status` : `${base}/review`,
      available: false,
    },
    {
      id: "campaign_review",
      label: "Campaign review",
      status: registration.campaignReviewStatus,
      href: `${base}/status`,
      available: false,
    },
    {
      id: "choose_number",
      label: "Choose number",
      status: registration.numberStatus,
      href: `${base}/number`,
      available: false,
    },
    {
      id: "ready_to_text",
      label: "Ready to text",
      status: registration.messagingStatus,
      href: base,
      available: false,
    },
  ];
  return steps.map((step) => ({
    ...step,
    available: isStepAvailable(registration, step.id),
  }));
}

export function buildRegistrationTimeline(
  registration: MessagingRegistration
): MessagingTimelineItem[] {
  const brandDone = isDone(registration.brandVerificationStatus);
  const campaignDone = isDone(registration.campaignReviewStatus);
  const numberDone =
    Boolean(registration.phoneNumberE164) || isDone(registration.numberStatus);
  const ready = isMessagingReady(registration);

  const awaitingReview =
    Boolean(registration.submittedAt) &&
    !campaignDone &&
    registration.overallStatus !== "failed" &&
    registration.overallStatus !== "action_required";

  return [
    {
      id: "business_submitted",
      label: "Business submitted",
      detail: "Secondary customer profile details on file",
      state: isStarted(registration.businessDetailsStatus)
        ? isDone(registration.businessDetailsStatus) || Boolean(registration.submittedAt)
          ? "complete"
          : registration.businessDetailsStatus === "failed"
            ? "failed"
            : "current"
        : "pending",
      at: registration.twilio.profileSubmittedAt ?? registration.submittedAt,
    },
    {
      id: "brand_submitted",
      label: "Brand submitted",
      detail: brandDone ? "Brand verification approved" : "Brand registration with The Campaign Registry",
      state: brandDone
        ? "complete"
        : registration.brandVerificationStatus === "failed" ||
            registration.brandVerificationStatus === "action_required"
          ? "failed"
          : isStarted(registration.brandVerificationStatus)
            ? "current"
            : "pending",
      at: registration.twilio.brandSid ? registration.submittedAt : null,
    },
    {
      id: "awaiting_review",
      label: awaitingReview ? "Awaiting review" : campaignDone ? "Campaign approved" : "Campaign review",
      detail: campaignDone
        ? "Campaign ready for messaging"
        : "Carrier review commonly takes 1–2 weeks",
      state: campaignDone
        ? "complete"
        : registration.campaignReviewStatus === "failed" ||
            registration.campaignReviewStatus === "action_required"
          ? "failed"
          : awaitingReview
            ? "current"
            : "pending",
      at: registration.twilio.campaignApprovedAt ?? registration.twilio.campaignSubmittedAt,
    },
    {
      id: "phone_reserved",
      label: registration.messagingEnabled ? "Phone assigned" : "Phone reserved",
      detail: registration.phoneNumberFriendly ?? "Choose a local number when ready",
      state: numberDone
        ? "complete"
        : registration.numberStatus === "failed"
          ? "failed"
          : campaignDone
            ? "current"
            : "pending",
      at: numberDone ? registration.updatedAt : null,
    },
    {
      id: "ready",
      label: "Ready to text",
      detail: ready
        ? "Outbound review-request messaging is active"
        : "Enabled after campaign approval and number assignment",
      state: ready ? "complete" : "pending",
      at: ready ? registration.updatedAt : null,
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
