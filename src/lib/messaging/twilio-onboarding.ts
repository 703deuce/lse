/**
 * Remaining Twilio ISV A2P stages after Secondary Customer Profile:
 * Trust Product → Brand → Messaging Service → Campaign → Phone Number → Send.
 */
import { getTwilioSmsWebhookUrl } from "@/lib/app-url";
import { normalizePhoneE164 } from "@/lib/reputation/phone";
import {
  evaluationFailureReasons,
  refreshSecondaryCustomerProfileStatus,
  resolveSubClient,
  twilioErrorMessage,
  type TwilioAdapterResult,
} from "./twilio-adapter";
import {
  getTwilioComplianceStatusCallbackUrl,
  getTwilioMessagingWebhookUrls,
  getTwilioStatusEmail,
  TWILIO_A2P_TRUST_PRODUCT_POLICY_SID,
} from "./twilio-config";
import { mapTwilioCompanyType } from "./twilio-mappings";
import { mapTwilioStatus } from "./status";
import type { AvailablePhoneNumber, MessagingRegistration } from "./types";

const USA2P_FETCH_SID = "QE2c6890da8086d771620e9b13fadeba0b";

function isApprovedStatus(raw: string | null | undefined): boolean {
  const mapped = mapTwilioStatus(raw);
  return mapped === "approved" || mapped === "ready";
}

function brandApproved(raw: string | null | undefined): boolean {
  return (raw ?? "").toUpperCase() === "APPROVED";
}

function campaignVerified(raw: string | null | undefined): boolean {
  return (raw ?? "").toUpperCase() === "VERIFIED";
}

export function buildCampaignMessageFlow(reg: MessagingRegistration): string {
  const name = reg.business.legalBusinessName.trim() || reg.businessName;
  const method = reg.useCase.optInMethod.trim() || "at booking / checkout";
  const language = reg.useCase.optInLanguage.trim();
  const consent = reg.useCase.consentPageUrl.trim();
  const privacy = reg.useCase.privacyPolicyUrl.trim();
  const terms = reg.useCase.termsUrl.trim();
  const parts = [
    `End users provide their mobile number and consent to receive service-related follow-up texts from ${name} via ${method}.`,
    language ||
      `Consent language discloses that message frequency varies, message and data rates may apply, and that consent is not a condition of purchase.`,
    consent ? `Consent capture page: ${consent}.` : "",
    `Customers can reply STOP to opt out and HELP for help.`,
    privacy ? `Privacy Policy: ${privacy}.` : "",
    terms ? `Terms and Conditions: ${terms}.` : "",
  ].filter(Boolean);
  const flow = parts.join(" ");
  return flow.length >= 40 ? flow.slice(0, 2048) : `${flow} Message and data rates may apply.`.slice(0, 2048);
}

export function isLiveMessagingReady(reg: MessagingRegistration): boolean {
  return (
    isApprovedStatus(reg.twilio.customerProfileStatus) &&
    isApprovedStatus(reg.twilio.a2pTrustProductStatus) &&
    brandApproved(reg.twilio.brandStatus) &&
    campaignVerified(reg.twilio.campaignStatus) &&
    Boolean(reg.twilio.messagingServiceSid) &&
    Boolean(reg.twilio.phoneNumberSid) &&
    Boolean(reg.twilio.phoneNumberAttached) &&
    !reg.messagingPaused
  );
}

/**
 * Customers may buy a number once a Twilio subaccount exists (or in mock mode).
 * The service layer creates the subaccount on purchase/search if needed.
 * A2P send stays blocked until campaign VERIFIED + number attached to MS.
 */
export function canPurchaseNumber(reg: MessagingRegistration): boolean {
  return Boolean(reg.twilio.subaccountSid) || reg.adapterMode === "mock";
}

export async function createAndSubmitA2PTrustProduct(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  // Twilio ISV guide: you may continue after profile submit; approval is not required.
  if (!reg.twilio.customerProfileSid) {
    throw new Error("Secondary Customer Profile SID is required before creating the A2P Trust Product.");
  }
  if (
    reg.twilio.a2pTrustProductSid &&
    reg.twilio.a2pTrustProductStatus &&
    reg.twilio.a2pTrustProductStatus !== "draft"
  ) {
    return refreshTrustProductStatus(reg);
  }

  const client = await resolveSubClient(reg);
  const friendly = reg.business.legalBusinessName.trim() || reg.businessName;
  const events: TwilioAdapterResult["events"] = [];
  const now = new Date().toISOString();
  let trustSid = reg.twilio.a2pTrustProductSid;
  let endUserSid = reg.twilio.a2pEndUserSid;
  let evaluationSid = reg.twilio.a2pEvaluationSid;

  try {
    if (!trustSid) {
      const trust = await client.trusthub.v1.trustProducts.create({
        friendlyName: `${friendly} A2P Trust Product`.slice(0, 255),
        email: getTwilioStatusEmail(),
        policySid: TWILIO_A2P_TRUST_PRODUCT_POLICY_SID,
        ...(getTwilioComplianceStatusCallbackUrl()
          ? { statusCallback: getTwilioComplianceStatusCallbackUrl() }
          : {}),
      });
      trustSid = trust.sid;
      events.push({
        eventType: "a2p_trust_product_created",
        message: "A2P Trust Product created.",
        payload: { sid: trustSid },
      });
    }

    if (!endUserSid) {
      const companyType = mapTwilioCompanyType(reg.business.businessIdentity);
      const attributes: Record<string, string> = { company_type: companyType };
      if (companyType === "public") {
        // Public brands need stock fields — not collected yet; fail clearly.
        throw new Error(
          "Public company A2P registration requires stock exchange and ticker. Update business identity or contact support."
        );
      }
      const endUser = await client.trusthub.v1.endUsers.create({
        friendlyName: `${friendly} Messaging Profile EndUser`.slice(0, 255),
        type: "us_a2p_messaging_profile_information",
        attributes,
      });
      endUserSid = endUser.sid;
      await client.trusthub.v1
        .trustProducts(trustSid)
        .trustProductsEntityAssignments.create({ objectSid: endUserSid });
    }

    // Attach Secondary Customer Profile
    await client.trusthub.v1
      .trustProducts(trustSid)
      .trustProductsEntityAssignments.create({
        objectSid: reg.twilio.customerProfileSid!,
      })
      .catch((err: unknown) => {
        const msg = twilioErrorMessage(err).toLowerCase();
        if (!/already|duplicate|20409/.test(msg)) throw err;
      });

    const evaluation = await client.trusthub.v1
      .trustProducts(trustSid)
      .trustProductsEvaluations.create({
        policySid: TWILIO_A2P_TRUST_PRODUCT_POLICY_SID,
      });
    evaluationSid = evaluation.sid;
    const failures = evaluationFailureReasons(evaluation.results);
    if (String(evaluation.status).toLowerCase() === "noncompliant") {
      return {
        registration: {
          ...reg,
          brandVerificationStatus: "action_required",
          overallStatus: "action_required",
          lastError: failures[0] ?? "A2P Trust Product evaluation failed.",
          twilio: {
            ...reg.twilio,
            a2pTrustProductSid: trustSid,
            a2pEndUserSid: endUserSid,
            a2pEvaluationSid: evaluationSid,
            a2pTrustProductStatus: "draft",
            a2pFailureReasons: failures,
          },
          updatedAt: now,
        },
        events: [
          ...events,
          {
            eventType: "a2p_trust_product_evaluation_failed",
            message: "A2P Trust Product evaluation failed.",
            payload: { failures },
          },
        ],
      };
    }

    const submitted = await client.trusthub.v1
      .trustProducts(trustSid)
      .update({ status: "pending-review" });

    return {
      registration: {
        ...reg,
        brandVerificationStatus: "in_review",
        lastError: null,
        twilio: {
          ...reg.twilio,
          a2pTrustProductSid: trustSid,
          a2pEndUserSid: endUserSid,
          a2pEvaluationSid: evaluationSid,
          a2pTrustProductStatus: submitted.status ?? "pending-review",
          a2pFailureReasons: [],
        },
        updatedAt: now,
        lastStatusCheckedAt: now,
      },
      events: [
        ...events,
        {
          eventType: "a2p_trust_product_submitted",
          message: "A2P Trust Product submitted for review.",
          payload: { sid: trustSid, status: submitted.status },
        },
      ],
    };
  } catch (err) {
    const message = twilioErrorMessage(err);
    return {
      registration: {
        ...reg,
        lastError: message,
        brandVerificationStatus: "action_required",
        overallStatus: "action_required",
        twilio: {
          ...reg.twilio,
          a2pTrustProductSid: trustSid,
          a2pEndUserSid: endUserSid,
          a2pEvaluationSid: evaluationSid,
          a2pFailureReasons: [message],
        },
        updatedAt: now,
      },
      events: [
        ...events,
        {
          eventType: "a2p_trust_product_failed",
          message: `A2P Trust Product failed: ${message}`,
        },
      ],
    };
  }
}

export async function refreshTrustProductStatus(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.a2pTrustProductSid) return { registration: reg, events: [] };
  const client = await resolveSubClient(reg);
  const trust = await client.trusthub.v1.trustProducts(reg.twilio.a2pTrustProductSid).fetch();
  const now = new Date().toISOString();
  const raw = trust.status ?? reg.twilio.a2pTrustProductStatus;
  const mapped = mapTwilioStatus(raw);
  return {
    registration: {
      ...reg,
      lastStatusCheckedAt: now,
      updatedAt: now,
      twilio: {
        ...reg.twilio,
        a2pTrustProductStatus: raw,
      },
      brandVerificationStatus:
        mapped === "approved"
          ? reg.brandVerificationStatus === "approved"
            ? "approved"
            : "in_review"
          : mapped === "action_required" || mapped === "failed"
            ? "action_required"
            : reg.brandVerificationStatus,
      overallStatus:
        mapped === "action_required" || mapped === "failed"
          ? "action_required"
          : reg.overallStatus,
    },
    events: [
      {
        eventType: "a2p_trust_product_status_refreshed",
        message: `A2P Trust Product status: ${raw}`,
        payload: { sid: trust.sid, status: raw },
      },
    ],
  };
}

export async function createBrandRegistration(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (reg.twilio.brandSid) return refreshBrandStatus(reg);
  if (!reg.twilio.customerProfileSid || !reg.twilio.a2pTrustProductSid) {
    throw new Error("Customer profile and A2P Trust Product are required before Brand Registration.");
  }
  // Twilio ISV guide: Brand can be created after Trust Product submit (approval not required).
  if (
    !reg.twilio.a2pTrustProductStatus ||
    reg.twilio.a2pTrustProductStatus === "draft"
  ) {
    throw new Error("A2P Trust Product must be submitted before Brand Registration.");
  }

  const client = await resolveSubClient(reg);
  const now = new Date().toISOString();
  const lowVolume = (reg.useCase.expectedMonthlyVolume ?? 300) < 6000;
  const brand = await client.messaging.v1.brandRegistrations.create({
    customerProfileBundleSid: reg.twilio.customerProfileSid,
    a2PProfileBundleSid: reg.twilio.a2pTrustProductSid,
    brandType: reg.business.businessIdentity === "sole_proprietor" ? "SOLE_PROPRIETOR" : "STANDARD",
    ...(lowVolume && reg.business.businessIdentity !== "sole_proprietor"
      ? { skipAutomaticSecVet: true }
      : {}),
  });

  return {
    registration: {
      ...reg,
      brandType: brand.brandType ?? "STANDARD",
      brandVerificationStatus: "in_review",
      overallStatus: "in_review",
      twilio: {
        ...reg.twilio,
        brandSid: brand.sid,
        brandStatus: brand.status ?? "PENDING",
        brandIdentityStatus: brand.identityStatus ?? null,
        brandFailureReason: brand.failureReason ?? null,
        brandSubmittedAt: now,
      },
      updatedAt: now,
      lastStatusCheckedAt: now,
      lastError: null,
    },
    events: [
      {
        eventType: "brand_submitted",
        message: "Brand registration submitted to The Campaign Registry.",
        payload: { sid: brand.sid, status: brand.status },
      },
    ],
  };
}

export async function refreshBrandStatus(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.brandSid) return { registration: reg, events: [] };
  const client = await resolveSubClient(reg);
  const brand = await client.messaging.v1.brandRegistrations(reg.twilio.brandSid).fetch();
  const now = new Date().toISOString();
  const status = brand.status ?? reg.twilio.brandStatus;
  const approved = brandApproved(status);
  const failed = ["FAILED", "REJECTED"].includes((status ?? "").toUpperCase());
  const events: TwilioAdapterResult["events"] = [
    {
      eventType: "brand_status_refreshed",
      message: `Brand status: ${status}`,
      payload: { sid: brand.sid, status },
    },
  ];
  if (approved && reg.brandVerificationStatus !== "approved") {
    events.push({ eventType: "brand_approved", message: "Brand registration approved." });
  }
  return {
    registration: {
      ...reg,
      brandVerificationStatus: approved
        ? "approved"
        : failed
          ? "action_required"
          : "in_review",
      overallStatus: failed ? "action_required" : reg.overallStatus,
      brandEmailVerificationStatus: approved
        ? "verified"
        : reg.brandEmailVerificationStatus,
      lastError: failed ? brand.failureReason ?? "Brand registration failed." : reg.lastError,
      twilio: {
        ...reg.twilio,
        brandStatus: status,
        brandIdentityStatus: brand.identityStatus ?? reg.twilio.brandIdentityStatus,
        brandFailureReason: brand.failureReason ?? reg.twilio.brandFailureReason,
        brandApprovedAt: approved ? reg.twilio.brandApprovedAt ?? now : reg.twilio.brandApprovedAt,
      },
      lastStatusCheckedAt: now,
      updatedAt: now,
    },
    events,
  };
}

export async function createMessagingService(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (reg.twilio.messagingServiceSid) {
    return { registration: reg, events: [] };
  }
  if (!brandApproved(reg.twilio.brandStatus)) {
    throw new Error("Brand must be APPROVED before creating a Messaging Service.");
  }
  const client = await resolveSubClient(reg);
  const hooks = getTwilioMessagingWebhookUrls();
  const friendly = `${reg.businessName} - Review Requests`.slice(0, 64);
  const service = await client.messaging.v1.services.create({
    friendlyName: friendly,
    inboundRequestUrl: hooks.inboundRequestUrl,
    statusCallback: hooks.statusCallback,
  });
  const now = new Date().toISOString();
  return {
    registration: {
      ...reg,
      twilio: {
        ...reg.twilio,
        messagingServiceSid: service.sid,
      },
      updatedAt: now,
    },
    events: [
      {
        eventType: "messaging_service_created",
        message: "Messaging Service created for review-request campaign.",
        payload: { sid: service.sid },
      },
    ],
  };
}

export async function createA2PCampaign(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (reg.twilio.campaignSid) return refreshCampaignStatus(reg);
  if (!brandApproved(reg.twilio.brandStatus) || !reg.twilio.brandSid) {
    throw new Error("Brand must be APPROVED before creating an A2P Campaign.");
  }
  if (!reg.twilio.messagingServiceSid) {
    throw new Error("Messaging Service is required before creating an A2P Campaign.");
  }

  const client = await resolveSubClient(reg);
  const samples = reg.useCase.sampleMessages.map((s) => s.trim()).filter(Boolean);
  if (samples.length < 2) {
    throw new Error("At least two message samples are required for campaign registration.");
  }
  const description = reg.useCase.campaignDescription.trim();
  if (description.length < 40) {
    throw new Error("Campaign description must be at least 40 characters.");
  }

  const now = new Date().toISOString();
  const campaign = await client.messaging.v1
    .services(reg.twilio.messagingServiceSid)
    .usAppToPerson.create({
      brandRegistrationSid: reg.twilio.brandSid,
      description: description.slice(0, 4096),
      messageFlow: buildCampaignMessageFlow(reg),
      messageSamples: samples.slice(0, 5),
      usAppToPersonUsecase: reg.useCase.campaignUseCase || "CUSTOMER_CARE",
      hasEmbeddedLinks: reg.useCase.messagesIncludeLinks,
      hasEmbeddedPhone: reg.useCase.messagesIncludePhoneNumbers,
      privacyPolicyUrl: reg.useCase.privacyPolicyUrl.trim(),
      termsAndConditionsUrl: reg.useCase.termsUrl.trim(),
      optInMessage: undefined,
      // Twilio default opt-out/help when omitted
    });

  return {
    registration: {
      ...reg,
      campaignReviewStatus: "in_review",
      useCaseStatus: "submitted",
      overallStatus: "in_review",
      twilio: {
        ...reg.twilio,
        campaignSid: campaign.sid,
        campaignStatus: campaign.campaignStatus ?? "PENDING",
        campaignUseCase: reg.useCase.campaignUseCase,
        campaignSubmittedAt: now,
        campaignFailureReason: null,
      },
      updatedAt: now,
      lastStatusCheckedAt: now,
      lastError: null,
    },
    events: [
      {
        eventType: "campaign_submitted",
        message: "A2P campaign submitted for carrier review (commonly 10–15 days).",
        payload: { sid: campaign.sid, status: campaign.campaignStatus },
      },
    ],
  };
}

export async function refreshCampaignStatus(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.messagingServiceSid) return { registration: reg, events: [] };
  const client = await resolveSubClient(reg);
  const sid = reg.twilio.campaignSid || USA2P_FETCH_SID;
  let campaign;
  try {
    campaign = await client.messaging.v1
      .services(reg.twilio.messagingServiceSid)
      .usAppToPerson(sid)
      .fetch();
  } catch {
    const list = await client.messaging.v1
      .services(reg.twilio.messagingServiceSid)
      .usAppToPerson.list({ limit: 5 });
    campaign = list[0];
  }
  if (!campaign) return { registration: reg, events: [] };

  const now = new Date().toISOString();
  const status = campaign.campaignStatus ?? reg.twilio.campaignStatus;
  const verified = campaignVerified(status);
  const failed = (status ?? "").toUpperCase() === "FAILED";
  const errors = Array.isArray(campaign.errors)
    ? campaign.errors.map((e) =>
        typeof e === "string"
          ? e
          : String((e as { description?: string; error_code?: string }).description ?? JSON.stringify(e))
      )
    : [];

  const events: TwilioAdapterResult["events"] = [
    {
      eventType: "campaign_status_refreshed",
      message: `Campaign status: ${status}`,
      payload: { sid: campaign.sid, status },
    },
  ];
  if (verified && reg.campaignReviewStatus !== "approved") {
    events.push({
      eventType: "campaign_approved",
      message: "A2P campaign verified — messaging can activate once a number is attached.",
    });
  }

  return {
    registration: {
      ...reg,
      campaignReviewStatus: verified ? "approved" : failed ? "action_required" : "in_review",
      useCaseStatus: verified ? "approved" : reg.useCaseStatus,
      overallStatus: failed
        ? "action_required"
        : verified
          ? reg.phoneNumberE164
            ? reg.overallStatus
            : "approved"
          : reg.overallStatus,
      lastError: failed ? errors[0] ?? "Campaign registration failed." : reg.lastError,
      twilio: {
        ...reg.twilio,
        campaignSid: campaign.sid,
        campaignStatus: status,
        campaignFailureReason: failed ? errors.join("; ") : reg.twilio.campaignFailureReason,
        campaignApprovedAt: verified
          ? reg.twilio.campaignApprovedAt ?? now
          : reg.twilio.campaignApprovedAt,
      },
      lastStatusCheckedAt: now,
      updatedAt: now,
    },
    events,
  };
}

export async function searchAvailableNumbers(
  reg: MessagingRegistration,
  params: {
    areaCode?: string;
    city?: string;
    postalCode?: string;
    contains?: string;
  }
): Promise<AvailablePhoneNumber[]> {
  const client = await resolveSubClient(reg);
  const areaCode = params.areaCode?.replace(/\D/g, "") || undefined;
  const list = await client.availablePhoneNumbers("US").local.list({
    ...(areaCode ? { areaCode: Number(areaCode) } : {}),
    ...(params.city?.trim() ? { inLocality: params.city.trim() } : {}),
    ...(params.postalCode?.replace(/\D/g, "")
      ? { inPostalCode: params.postalCode.replace(/\D/g, "").slice(0, 5) }
      : {}),
    ...(params.contains?.replace(/\D/g, "")
      ? { contains: params.contains.replace(/\D/g, "") }
      : {}),
    smsEnabled: true,
    limit: 20,
  });

  return list.map((row) => {
    const e164 = row.phoneNumber ?? "";
    const digits = e164.replace(/\D/g, "");
    const friendly =
      digits.length === 11 && digits.startsWith("1")
        ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
        : e164;
    return {
      phoneNumber: e164,
      friendlyName: friendly,
      locality: row.locality ?? "",
      region: row.region ?? "",
      type: "local" as const,
      capabilities: {
        sms: Boolean(row.capabilities?.sms),
        mms: Boolean(row.capabilities?.mms),
        voice: Boolean(row.capabilities?.voice),
      },
      monthlyCost: 1.15,
    };
  });
}

/** Attach an already-purchased PN… to the Messaging Service when both exist. */
export async function attachPurchasedNumberToMessagingService(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.phoneNumberSid || !reg.twilio.messagingServiceSid) {
    return { registration: reg, events: [] };
  }
  if (reg.twilio.phoneNumberAttached) {
    return { registration: reg, events: [] };
  }

  const client = await resolveSubClient(reg);
  try {
    await client.messaging.v1
      .services(reg.twilio.messagingServiceSid)
      .phoneNumbers.create({ phoneNumberSid: reg.twilio.phoneNumberSid });
  } catch (err) {
    const msg = twilioErrorMessage(err).toLowerCase();
    // Already in the sender pool is fine.
    if (!/already|duplicate|20404|same/.test(msg)) throw err;
  }

  const now = new Date().toISOString();
  const campaignOk = campaignVerified(reg.twilio.campaignStatus);
  const next: MessagingRegistration = {
    ...reg,
    numberStatus: campaignOk ? "approved" : reg.numberStatus,
    twilio: {
      ...reg.twilio,
      phoneNumberAttached: true,
      phoneNumberAttachedAt: now,
    },
    updatedAt: now,
  };
  const ready = isLiveMessagingReady(next);
  return {
    registration: {
      ...next,
      messagingEnabled: ready ? !reg.messagingPaused : false,
      messagingStatus: ready ? "ready" : reg.messagingStatus,
      overallStatus: ready ? "ready" : reg.overallStatus,
      setupStep: ready ? "ready" : reg.setupStep,
      numberStatus: ready || campaignOk ? "approved" : next.numberStatus,
    },
    events: [
      {
        eventType: "number_attached_to_messaging_service",
        message: `Phone number attached to Messaging Service${
          campaignOk ? "" : " — outbound SMS waits until the campaign is VERIFIED"
        }.`,
        payload: {
          phoneNumberSid: reg.twilio.phoneNumberSid,
          messagingServiceSid: reg.twilio.messagingServiceSid,
        },
      },
    ],
  };
}

/**
 * Purchase a US local number on the customer subaccount.
 * Messaging Service attach happens now if MG… exists, otherwise later in the worker.
 */
export async function purchaseAndAttachNumber(
  reg: MessagingRegistration,
  phoneNumber: string
): Promise<TwilioAdapterResult> {
  if (!canPurchaseNumber(reg) || !reg.twilio.subaccountSid) {
    throw new Error("Twilio subaccount is required before purchasing a number.");
  }
  if (reg.twilio.phoneNumberSid && reg.phoneNumberE164 === phoneNumber) {
    if (reg.twilio.messagingServiceSid && !reg.twilio.phoneNumberAttached) {
      return attachPurchasedNumberToMessagingService(reg);
    }
    return { registration: reg, events: [] };
  }

  const client = await resolveSubClient(reg);
  const e164 = normalizePhoneE164(phoneNumber) || phoneNumber;
  const hooks = getTwilioMessagingWebhookUrls();
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: e164,
    smsUrl: hooks.inboundRequestUrl,
    statusCallback: hooks.statusCallback,
  });

  const now = new Date().toISOString();
  const digits = e164.replace(/\D/g, "");
  const friendly =
    digits.length === 11 && digits.startsWith("1")
      ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
      : e164;

  let next: MessagingRegistration = {
    ...reg,
    phoneNumberE164: e164,
    phoneNumberFriendly: friendly,
    phoneNumberLocality: reg.phoneNumberLocality,
    phoneNumberMonthlyCost: 1.15,
    phoneNumberCapabilities: {
      sms: true,
      mms: Boolean(purchased.capabilities?.mms),
      voice: Boolean(purchased.capabilities?.voice),
    },
    phoneNumberReserved: true,
    phoneNumberPurchasedAt: now,
    numberStatus: "submitted",
    // Never enable outbound until campaign VERIFIED + attached.
    messagingEnabled: false,
    messagingStatus: "not_started",
    setupStep: reg.setupStep === "ready" ? "number" : reg.setupStep,
    twilio: {
      ...reg.twilio,
      phoneNumberSid: purchased.sid,
      phoneNumberAttached: false,
      phoneNumberAttachedAt: null,
    },
    updatedAt: now,
    lastStatusCheckedAt: now,
  };

  const events: TwilioAdapterResult["events"] = [
    {
      eventType: "number_purchased",
      message: `Phone number ${friendly} purchased. It becomes available for texting after A2P registration is approved.`,
      payload: { phoneNumber: e164, sid: purchased.sid, monthlyCost: 1.15 },
    },
  ];

  if (next.twilio.messagingServiceSid) {
    const attached = await attachPurchasedNumberToMessagingService(next);
    next = attached.registration;
    events.push(...attached.events);
  }

  return { registration: next, events };
}

/** Days to keep an unused purchased number before auto-release (abandoned registration). */
export function numberPurchaseGraceDays(): number {
  const raw = Number(process.env.MESSAGING_NUMBER_GRACE_DAYS ?? "14");
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

/**
 * Release numbers bought then abandoned (never started/submitted A2P).
 * Keep numbers while Brand/Campaign review is in progress — TCR can take weeks.
 */
export function shouldAutoReleaseUnusedNumber(reg: MessagingRegistration, now = Date.now()): boolean {
  if (!reg.twilio.phoneNumberSid || !reg.phoneNumberPurchasedAt) return false;
  if (isLiveMessagingReady(reg) || campaignVerified(reg.twilio.campaignStatus)) return false;
  // Actively registering — do not release while waiting on Twilio/TCR.
  if (
    reg.submittedAt ||
    reg.twilio.profileSubmittedAt ||
    reg.twilio.brandSid ||
    reg.twilio.campaignSid
  ) {
    return false;
  }
  const purchased = Date.parse(reg.phoneNumberPurchasedAt);
  if (!Number.isFinite(purchased)) return false;
  const graceMs = numberPurchaseGraceDays() * 24 * 60 * 60 * 1000;
  return now - purchased >= graceMs;
}

export async function releasePhoneNumber(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  if (!reg.twilio.phoneNumberSid) {
    return { registration: reg, events: [] };
  }
  const client = await resolveSubClient(reg);
  if (reg.twilio.messagingServiceSid) {
    await client.messaging.v1
      .services(reg.twilio.messagingServiceSid)
      .phoneNumbers(reg.twilio.phoneNumberSid)
      .remove()
      .catch(() => undefined);
  }
  await client.incomingPhoneNumbers(reg.twilio.phoneNumberSid).remove().catch(() => undefined);
  const now = new Date().toISOString();
  return {
    registration: {
      ...reg,
      phoneNumberE164: null,
      phoneNumberFriendly: null,
      phoneNumberLocality: null,
      phoneNumberRegion: null,
      phoneNumberMonthlyCost: null,
      phoneNumberCapabilities: {},
      phoneNumberReserved: false,
      phoneNumberPurchasedAt: null,
      numberStatus: "not_started",
      messagingEnabled: false,
      messagingStatus: "not_started",
      overallStatus:
        reg.overallStatus === "ready" ? "approved" : reg.overallStatus,
      setupStep: "number",
      twilio: {
        ...reg.twilio,
        phoneNumberSid: null,
        phoneNumberAttached: false,
        phoneNumberAttachedAt: null,
      },
      updatedAt: now,
    },
    events: [
      {
        eventType: "number_released",
        message: "Phone number released from the Twilio subaccount.",
      },
    ],
  };
}

export async function sendSmsViaMessagingService(params: {
  registration: MessagingRegistration;
  toPhone: string;
  body: string;
}): Promise<{ ok: true; messageSid: string } | { ok: false; error: string }> {
  const reg = params.registration;
  if (!isLiveMessagingReady(reg)) {
    return {
      ok: false,
      error:
        "SMS is blocked until the Secondary Profile, Trust Product, Brand, Campaign, Messaging Service, and phone number are all approved/ready.",
    };
  }
  if (reg.messagingPaused) {
    return { ok: false, error: "Messaging is paused for this business." };
  }
  const to = normalizePhoneE164(params.toPhone);
  if (!to) return { ok: false, error: "Invalid phone number format" };

  try {
    const client = await resolveSubClient(reg);
    const statusCallback =
      getTwilioMessagingWebhookUrls().messageStatusCallback || getTwilioSmsWebhookUrl();
    const message = await client.messages.create({
      to,
      body: params.body,
      messagingServiceSid: reg.twilio.messagingServiceSid!,
      ...(statusCallback ? { statusCallback } : {}),
    });
    return { ok: true, messageSid: message.sid };
  } catch (err) {
    return { ok: false, error: twilioErrorMessage(err) };
  }
}

/** Poll every Twilio resource that exists for this registration. */
export async function refreshAllTwilioStatuses(
  reg: MessagingRegistration
): Promise<TwilioAdapterResult> {
  let current = reg;
  const events: TwilioAdapterResult["events"] = [];

  if (current.twilio.customerProfileSid) {
    const r = await refreshSecondaryCustomerProfileStatus(current);
    current = r.registration;
    events.push(...r.events);
  }
  if (current.twilio.a2pTrustProductSid) {
    const r = await refreshTrustProductStatus(current);
    current = r.registration;
    events.push(...r.events);
  }
  if (current.twilio.brandSid) {
    const r = await refreshBrandStatus(current);
    current = r.registration;
    events.push(...r.events);
  }
  if (current.twilio.messagingServiceSid && current.twilio.campaignSid) {
    const r = await refreshCampaignStatus(current);
    current = r.registration;
    events.push(...r.events);
  }

  if (isLiveMessagingReady(current) && !current.messagingEnabled) {
    current = {
      ...current,
      messagingEnabled: true,
      messagingStatus: "ready",
      overallStatus: "ready",
      setupStep: "ready",
      numberStatus: "approved",
    };
    events.push({
      eventType: "messaging_enabled",
      message: "All Twilio stages approved — text messaging is ready.",
    });
  }

  return { registration: current, events };
}
