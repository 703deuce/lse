import { decryptSecret, encryptSecret } from "@/lib/integrations/webhook-crypto";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import {
  getTwilioComplianceStatusCallbackUrl,
  getTwilioPrimaryProfileSid,
  getTwilioStatusEmail,
  TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
} from "./twilio-config";
import { createParentTwilioClient, createSubaccountTwilioClient } from "./twilio-client";
import {
  mapTwilioJobPosition,
  splitAuthRepName,
  toTrustHubBusinessAttributes,
} from "./twilio-mappings";
import { mapTwilioStatus } from "./status";
import type { MessagingRegistration } from "./types";
import {
  getSubaccountAuthTokenEncrypted,
  setSubaccountAuthTokenEncrypted,
} from "./store";

export type TwilioAdapterResult = {
  registration: MessagingRegistration;
  events: Array<{
    eventType: string;
    message: string;
    payload?: Record<string, unknown>;
  }>;
};

function twilioErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    message?: string;
    moreInfo?: string;
    code?: number | string;
    status?: number;
  };
  const parts = [
    e.message,
    e.code != null ? `code=${e.code}` : null,
    e.moreInfo,
  ].filter(Boolean);
  return parts.join(" · ") || "Twilio request failed";
}

function evaluationFailureReasons(results: unknown): string[] {
  if (!Array.isArray(results)) return [];
  const reasons: string[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      failure_reason?: string;
      failureReason?: string;
      passed?: boolean;
      invalid?: Array<{ failure_reason?: string; failureReason?: string }>;
    };
    if (row.passed === false) {
      const top = row.failure_reason || row.failureReason;
      if (top) reasons.push(String(top));
    }
    for (const inv of row.invalid ?? []) {
      const msg = inv.failure_reason || inv.failureReason;
      if (msg) reasons.push(String(msg));
    }
  }
  return reasons;
}

async function resolveSubClient(reg: MessagingRegistration) {
  const sid = reg.twilio.subaccountSid;
  if (!sid) throw new Error("Twilio subaccount has not been created yet.");
  const encrypted = await getSubaccountAuthTokenEncrypted(reg.businessId);
  if (!encrypted) {
    throw new Error(
      "Twilio subaccount auth token is missing. Restart registration or contact support."
    );
  }
  const authToken = decryptSecret(encrypted);
  if (!authToken) {
    throw new Error("Failed to decrypt Twilio subaccount auth token.");
  }
  return createSubaccountTwilioClient(sid, authToken);
}

/** Idempotent: create one Twilio subaccount per customer business. */
export async function createCustomerSubaccount(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (reg.twilio.subaccountSid) {
    return {
      registration: reg,
      events: [
        {
          eventType: "subaccount_reused",
          message: "Existing Twilio subaccount reused (idempotent).",
          payload: { sid: reg.twilio.subaccountSid },
        },
      ],
    };
  }

  const parent = createParentTwilioClient();
  const friendlyName = `Local SEO Express - ${reg.businessName}`.slice(0, 64);
  const subaccount = await parent.api.v2010.accounts.create({ friendlyName });
  const now = new Date().toISOString();
  const authToken = subaccount.authToken;
  if (!authToken) {
    throw new Error("Twilio did not return a subaccount auth token.");
  }

  await setSubaccountAuthTokenEncrypted(reg.businessId, encryptSecret(authToken), {
    organizationId: reg.organizationId,
    registrationId: reg.id.startsWith("mem_") ? null : reg.id,
  });

  const next: MessagingRegistration = {
    ...reg,
    adapterMode: "twilio",
    setupStep: reg.setupStep === "overview" ? "business" : reg.setupStep,
    overallStatus:
      reg.overallStatus === "not_started" ? "action_required" : reg.overallStatus,
    twilio: {
      ...reg.twilio,
      subaccountSid: subaccount.sid,
      subaccountStatus: subaccount.status ?? "active",
      subaccountCreatedAt: now,
    },
    updatedAt: now,
    lastError: null,
  };

  return {
    registration: next,
    events: [
      {
        eventType: "subaccount_created",
        message: "Twilio subaccount created for this customer.",
        payload: { sid: subaccount.sid, status: subaccount.status },
      },
    ],
  };
}

/**
 * Create + evaluate + submit Secondary Customer Profile (TrustHub steps 1.1–1.11).
 * Idempotent when a profile SID already exists and was submitted.
 */
export async function createAndSubmitSecondaryCustomerProfile(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.subaccountSid) {
    throw new Error("Create a Twilio subaccount before submitting the business profile.");
  }

  const primaryProfileSid = getTwilioPrimaryProfileSid();
  if (!primaryProfileSid) {
    throw new Error("TWILIO_PRIMARY_PROFILE_SID is required (approved Primary Profile BU...).");
  }

  // Already submitted — refresh only.
  if (
    reg.twilio.customerProfileSid &&
    reg.twilio.profileSubmittedAt &&
    reg.twilio.customerProfileStatus &&
    reg.twilio.customerProfileStatus !== "draft"
  ) {
    return refreshSecondaryCustomerProfileStatus(reg);
  }

  const client = await resolveSubClient(reg);
  const business = reg.business;
  const friendly = business.legalBusinessName.trim() || reg.businessName;
  const statusEmail = getTwilioStatusEmail();
  const statusCallback = getTwilioComplianceStatusCallbackUrl();
  const events: TwilioAdapterResult["events"] = [];
  const now = new Date().toISOString();

  let profileSid = reg.twilio.customerProfileSid;
  let businessEndUserSid = reg.twilio.businessEndUserSid;
  let rep1Sid = reg.twilio.authorizedRepEndUserSid;
  let addressSid = reg.twilio.addressSid;
  let supportingDocumentSid = reg.twilio.supportingDocumentSid;
  let evaluationSid = reg.twilio.profileEvaluationSid;

  try {
    // 1.1 Empty Secondary Customer Profile
    if (!profileSid) {
      const profile = await client.trusthub.v1.customerProfiles.create({
        friendlyName: `${friendly} Secondary Customer Profile`.slice(0, 255),
        email: statusEmail,
        policySid: TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
        ...(statusCallback ? { statusCallback } : {}),
      });
      profileSid = profile.sid;
      events.push({
        eventType: "customer_profile_created",
        message: "Secondary Customer Profile created.",
        payload: { sid: profileSid, status: profile.status },
      });
    }

    // 1.2–1.3 Business EndUser
    if (!businessEndUserSid) {
      const endUser = await client.trusthub.v1.endUsers.create({
        friendlyName: `${friendly} Business Information`.slice(0, 255),
        type: "customer_profile_business_information",
        attributes: toTrustHubBusinessAttributes(business),
      });
      businessEndUserSid = endUser.sid;
      await client.trusthub.v1
        .customerProfiles(profileSid)
        .customerProfilesEntityAssignments.create({ objectSid: businessEndUserSid });
      events.push({
        eventType: "business_end_user_attached",
        message: "Business information EndUser attached to profile.",
        payload: { sid: businessEndUserSid },
      });
    }

    // 1.4–1.5 Authorized representative
    if (!rep1Sid) {
      const { firstName, lastName } = splitAuthRepName(business.authRepFullName);
      const phone =
        normalizePhoneE164(business.authRepPhone) || business.authRepPhone.trim();
      const endUser = await client.trusthub.v1.endUsers.create({
        friendlyName: `${friendly} Authorized Rep 1`.slice(0, 255),
        type: "authorized_representative_1",
        attributes: {
          first_name: firstName,
          last_name: lastName,
          email: business.authRepEmail.trim(),
          phone_number: phone,
          business_title: business.authRepJobTitle.trim() || "Authorized Representative",
          job_position: mapTwilioJobPosition(
            business.authRepJobTitle,
            business.authRepRole
          ),
        },
      });
      rep1Sid = endUser.sid;
      await client.trusthub.v1
        .customerProfiles(profileSid)
        .customerProfilesEntityAssignments.create({ objectSid: rep1Sid });
      events.push({
        eventType: "authorized_rep_attached",
        message: "Authorized representative attached to profile.",
        payload: { sid: rep1Sid },
      });
    }

    // 1.6–1.8 Address + SupportingDocument
    if (!addressSid) {
      const address = await client.addresses.create({
        customerName: friendly,
        friendlyName: `${friendly} mailing address`.slice(0, 64),
        street: business.addressLine1.trim(),
        ...(business.addressLine2.trim()
          ? { streetSecondary: business.addressLine2.trim() }
          : {}),
        city: business.city.trim(),
        region: business.region.trim(),
        postalCode: business.postalCode.trim(),
        isoCountry: (business.registrationCountry || "US").trim().slice(0, 2).toUpperCase(),
      });
      addressSid = address.sid;
    }

    if (!supportingDocumentSid && addressSid) {
      const doc = await client.trusthub.v1.supportingDocuments.create({
        friendlyName: `${friendly} Address`.slice(0, 255),
        type: "customer_profile_address",
        attributes: { address_sids: addressSid },
      });
      supportingDocumentSid = doc.sid;
      await client.trusthub.v1
        .customerProfiles(profileSid)
        .customerProfilesEntityAssignments.create({ objectSid: supportingDocumentSid });
      events.push({
        eventType: "address_attached",
        message: "Business address attached to profile.",
        payload: { addressSid, supportingDocumentSid },
      });
    }

    // 1.9 Assign Secondary → Primary Customer Profile
    await client.trusthub.v1
      .customerProfiles(profileSid)
      .customerProfilesEntityAssignments.create({ objectSid: primaryProfileSid })
      .catch((err: unknown) => {
        const msg = twilioErrorMessage(err).toLowerCase();
        // Already assigned is fine on retries.
        if (!/already|duplicate|20409|pending/.test(msg)) throw err;
      });

    // 1.10 Evaluate
    const evaluation = await client.trusthub.v1
      .customerProfiles(profileSid)
      .customerProfilesEvaluations.create({
        policySid: TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
      });
    evaluationSid = evaluation.sid;
    const failureReasons = evaluationFailureReasons(evaluation.results);
    if (String(evaluation.status).toLowerCase() === "noncompliant") {
      const next: MessagingRegistration = {
        ...reg,
        adapterMode: "twilio",
        businessDetailsStatus: "action_required",
        overallStatus: "action_required",
        lastError: failureReasons[0] ?? "Secondary Customer Profile is noncompliant.",
        twilio: {
          ...reg.twilio,
          customerProfileSid: profileSid,
          customerProfileStatus: "draft",
          businessEndUserSid,
          authorizedRepEndUserSid: rep1Sid,
          addressSid,
          supportingDocumentSid,
          profileEvaluationSid: evaluationSid,
          profileEvaluationStatus: String(evaluation.status),
          profileFailureReasons: failureReasons,
        },
        updatedAt: now,
      };
      return {
        registration: next,
        events: [
          ...events,
          {
            eventType: "customer_profile_evaluation_failed",
            message: "Profile evaluation failed — fix the listed fields and resubmit.",
            payload: { evaluationSid, status: evaluation.status, failureReasons },
          },
        ],
      };
    }

    // 1.11 Submit for review
    const submitted = await client.trusthub.v1
      .customerProfiles(profileSid)
      .update({ status: "pending-review" });

    const next: MessagingRegistration = {
      ...reg,
      adapterMode: "twilio",
      submittedAt: reg.submittedAt ?? now,
      setupStep: "status",
      overallStatus: "in_review",
      businessDetailsStatus: "in_review",
      useCaseStatus: "submitted",
      brandVerificationStatus: "not_started",
      brandType:
        reg.business.businessIdentity === "sole_proprietor" ? "SOLE_PROPRIETOR" : "STANDARD",
      lastError: null,
      lastStatusCheckedAt: now,
      twilio: {
        ...reg.twilio,
        customerProfileSid: profileSid,
        customerProfileStatus: submitted.status ?? "pending-review",
        businessEndUserSid,
        authorizedRepEndUserSid: rep1Sid,
        addressSid,
        supportingDocumentSid,
        profileEvaluationSid: evaluationSid,
        profileEvaluationStatus: String(evaluation.status),
        profileFailureReasons: [],
        profileSubmittedAt: now,
      },
      updatedAt: now,
    };

    return {
      registration: next,
      events: [
        ...events,
        {
          eventType: "customer_profile_submitted",
          message: "Secondary Customer Profile submitted to Twilio for review.",
          payload: { sid: profileSid, status: submitted.status },
        },
        {
          eventType: "registration_submitted",
          message:
            "Application submitted. Brand and campaign steps continue after profile approval.",
        },
      ],
    };
  } catch (err) {
    const message = twilioErrorMessage(err);
    const next: MessagingRegistration = {
      ...reg,
      adapterMode: "twilio",
      lastError: message,
      businessDetailsStatus: "action_required",
      overallStatus: "action_required",
      twilio: {
        ...reg.twilio,
        customerProfileSid: profileSid,
        businessEndUserSid,
        authorizedRepEndUserSid: rep1Sid,
        addressSid,
        supportingDocumentSid,
        profileEvaluationSid: evaluationSid,
        profileFailureReasons: [message],
      },
      updatedAt: now,
    };
    return {
      registration: next,
      events: [
        ...events,
        {
          eventType: "customer_profile_submit_failed",
          message: `Twilio profile submission failed: ${message}`,
        },
      ],
    };
  }
}

export async function refreshSecondaryCustomerProfileStatus(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.customerProfileSid || !reg.twilio.subaccountSid) {
    return { registration: reg, events: [] };
  }

  const client = await resolveSubClient(reg);
  const profile = await client.trusthub.v1
    .customerProfiles(reg.twilio.customerProfileSid)
    .fetch();
  const now = new Date().toISOString();
  const rawStatus = profile.status ?? reg.twilio.customerProfileStatus;
  const mapped = mapTwilioStatus(rawStatus);
  const errors = Array.isArray(profile.errors)
    ? profile.errors.map((e) =>
        typeof e === "string"
          ? e
          : String((e as { description?: string }).description ?? JSON.stringify(e))
      )
    : [];

  const next: MessagingRegistration = {
    ...reg,
    lastStatusCheckedAt: now,
    updatedAt: now,
    businessDetailsStatus:
      mapped === "approved"
        ? "approved"
        : mapped === "failed" || mapped === "action_required"
          ? "action_required"
          : mapped === "in_review"
            ? "in_review"
            : reg.businessDetailsStatus,
    overallStatus:
      mapped === "action_required" || mapped === "failed"
        ? "action_required"
        : reg.overallStatus === "not_started"
          ? "in_review"
          : reg.overallStatus,
    lastError: errors[0] ?? reg.lastError,
    twilio: {
      ...reg.twilio,
      customerProfileStatus: rawStatus,
      profileFailureReasons: errors.length ? errors : reg.twilio.profileFailureReasons,
      profileApprovedAt:
        mapped === "approved" ? reg.twilio.profileApprovedAt ?? now : reg.twilio.profileApprovedAt,
    },
  };

  const events: TwilioAdapterResult["events"] = [
    {
      eventType: "customer_profile_status_refreshed",
      message: `Secondary Customer Profile status: ${rawStatus}`,
      payload: { sid: profile.sid, status: rawStatus },
    },
  ];
  if (mapped === "approved" && reg.businessDetailsStatus !== "approved") {
    events.push({
      eventType: "customer_profile_approved",
      message: "Secondary Customer Profile approved by Twilio.",
    });
  }
  if (
    (mapped === "failed" || mapped === "action_required") &&
    reg.businessDetailsStatus !== "action_required"
  ) {
    events.push({
      eventType: "customer_profile_rejected",
      message: "Secondary Customer Profile needs attention.",
      payload: { errors },
    });
  }

  return { registration: next, events };
}

export async function refreshLiveRegistrationStatus(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  return refreshSecondaryCustomerProfileStatus(reg);
}
