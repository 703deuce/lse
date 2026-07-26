/**
 * State machine for Twilio ISV A2P onboarding.
 * Matches Twilio’s ISV guide: profile + trust product can proceed without
 * waiting for approval; Brand and Campaign require APPROVED / VERIFIED.
 */
import { JobDeferredError } from "@/lib/queue/errors";
import {
  createAndSubmitSecondaryCustomerProfile,
  createCustomerSubaccount,
} from "./twilio-adapter";
import {
  createA2PCampaign,
  createAndSubmitA2PTrustProduct,
  createBrandRegistration,
  createMessagingService,
  isLiveMessagingReady,
  refreshAllTwilioStatuses,
} from "./twilio-onboarding";
import { isLiveTwilioMessaging } from "./twilio-config";
import { mockReconcileStatus } from "./mock-adapter";
import { appendEvents, getRegistration, saveRegistration } from "./store";
import type { MessagingRegistration } from "./types";

const POLL_DELAY_MS = 15 * 60 * 1000;
const RATE_LIMIT_MS = 1100;

export type AdvanceResult = {
  registration: MessagingRegistration;
  done: boolean;
  waitingOn?: string;
};

async function persist(result: {
  registration: MessagingRegistration;
  events: Array<{ eventType: string; message: string; payload?: Record<string, unknown> }>;
}): Promise<MessagingRegistration> {
  const saved = await saveRegistration(result.registration);
  await appendEvents(saved, result.events);
  return saved;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function brandOk(raw: string | null | undefined): boolean {
  return (raw ?? "").toUpperCase() === "APPROVED";
}

function campaignOk(raw: string | null | undefined): boolean {
  return (raw ?? "").toUpperCase() === "VERIFIED";
}

/**
 * Advance one registration as far as Twilio will allow in this tick.
 * Throws JobDeferredError when waiting on Brand/Campaign approvals.
 */
export async function advanceMessagingRegistration(params: {
  organizationId: string;
  businessId: string;
  businessName: string;
}): Promise<AdvanceResult> {
  let reg = await getRegistration(params);

  if (!isLiveTwilioMessaging() && reg.adapterMode !== "twilio") {
    if (!reg.submittedAt) return { registration: reg, done: true };
    const mock = mockReconcileStatus(reg);
    reg = await persist(mock);
    const stillWaiting =
      reg.campaignReviewStatus === "in_review" ||
      reg.brandVerificationStatus === "in_review" ||
      reg.businessDetailsStatus === "in_review";
    if (stillWaiting) {
      throw new JobDeferredError("Mock registration still in review", POLL_DELAY_MS);
    }
    return { registration: reg, done: true };
  }

  // CREATE_SUBACCOUNT
  reg = await persist(await createCustomerSubaccount(reg));

  // CREATE + SUBMIT SECONDARY PROFILE
  if (!reg.twilio.profileSubmittedAt || !reg.twilio.customerProfileSid) {
    reg = await persist(await createAndSubmitSecondaryCustomerProfile(reg));
    if (
      reg.businessDetailsStatus === "action_required" &&
      !reg.twilio.profileSubmittedAt
    ) {
      return { registration: reg, done: true, waitingOn: "customer_profile_fix" };
    }
  }

  // CREATE + SUBMIT TRUST PRODUCT (Twilio: no need to wait for profile approval)
  if (
    reg.twilio.customerProfileSid &&
    reg.twilio.profileSubmittedAt &&
    !reg.twilio.a2pTrustProductSid
  ) {
    reg = await persist(await createAndSubmitA2PTrustProduct(reg));
    if (
      reg.overallStatus === "action_required" &&
      reg.twilio.a2pFailureReasons.length &&
      !String(reg.twilio.a2pTrustProductStatus ?? "").includes("pending")
    ) {
      return { registration: reg, done: true, waitingOn: "trust_product_fix" };
    }
  } else if (
    reg.twilio.a2pTrustProductStatus === "draft" &&
    reg.twilio.a2pFailureReasons.length
  ) {
    return { registration: reg, done: true, waitingOn: "trust_product_fix" };
  }

  // CREATE BRAND (Twilio: no need to wait for trust product approval)
  if (
    reg.twilio.customerProfileSid &&
    reg.twilio.a2pTrustProductSid &&
    !reg.twilio.brandSid &&
    reg.twilio.a2pTrustProductStatus &&
    reg.twilio.a2pTrustProductStatus !== "draft"
  ) {
    await sleep(RATE_LIMIT_MS);
    try {
      reg = await persist(await createBrandRegistration(reg));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/approv|pending|bundle/i.test(message)) {
        throw new JobDeferredError(`Brand not ready yet: ${message}`, POLL_DELAY_MS);
      }
      reg = await saveRegistration({
        ...reg,
        lastError: message,
        brandVerificationStatus: "action_required",
        overallStatus: "action_required",
      });
      await appendEvents(reg, [
        { eventType: "brand_create_failed", message: `Brand create failed: ${message}` },
      ]);
      return { registration: reg, done: true, waitingOn: "brand_failed" };
    }
  }

  // Refresh statuses
  reg = await persist(await refreshAllTwilioStatuses(reg));

  // WAIT_FOR_BRAND_APPROVAL before Messaging Service / Campaign
  if (reg.twilio.brandSid && !brandOk(reg.twilio.brandStatus)) {
    if (reg.brandVerificationStatus === "action_required") {
      return { registration: reg, done: true, waitingOn: "brand_failed" };
    }
    throw new JobDeferredError("Waiting for Brand Registration approval", POLL_DELAY_MS);
  }

  if (!reg.twilio.brandSid) {
    // Profile/trust not far enough yet
    throw new JobDeferredError("Waiting to create Brand Registration", POLL_DELAY_MS);
  }

  // CREATE_MESSAGING_SERVICE
  if (!reg.twilio.messagingServiceSid) {
    reg = await persist(await createMessagingService(reg));
  }

  // CREATE_CAMPAIGN
  if (!reg.twilio.campaignSid) {
    await sleep(RATE_LIMIT_MS);
    try {
      reg = await persist(await createA2PCampaign(reg));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reg = await saveRegistration({
        ...reg,
        lastError: message,
        campaignReviewStatus: "action_required",
        overallStatus: "action_required",
      });
      await appendEvents(reg, [
        { eventType: "campaign_create_failed", message: `Campaign create failed: ${message}` },
      ]);
      return { registration: reg, done: true, waitingOn: "campaign_failed" };
    }
  }

  // WAIT_FOR_CAMPAIGN_APPROVAL
  reg = await persist(await refreshAllTwilioStatuses(reg));
  if (!campaignOk(reg.twilio.campaignStatus)) {
    if (reg.campaignReviewStatus === "action_required") {
      return { registration: reg, done: true, waitingOn: "campaign_failed" };
    }
    throw new JobDeferredError("Waiting for A2P Campaign verification", POLL_DELAY_MS);
  }

  if (
    isLiveMessagingReady(reg) ||
    (campaignOk(reg.twilio.campaignStatus) && reg.twilio.phoneNumberSid)
  ) {
    if (!reg.messagingEnabled || reg.overallStatus !== "ready") {
      reg = await saveRegistration({
        ...reg,
        messagingEnabled: !reg.messagingPaused,
        messagingStatus: "ready",
        overallStatus: "ready",
        setupStep: "ready",
        numberStatus: "approved",
      });
      await appendEvents(reg, [
        {
          eventType: "messaging_ready",
          message: "Registration complete — SMS sending is enabled via the Messaging Service.",
        },
      ]);
    }
    return { registration: reg, done: true };
  }

  return { registration: reg, done: true, waitingOn: "choose_number" };
}
