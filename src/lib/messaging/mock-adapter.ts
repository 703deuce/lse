import type { AvailablePhoneNumber, MessagingRegistration } from "./types";

function sid(prefix: string): string {
  return `${prefix}${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`.slice(0, 34);
}

export const MOCK_PHONE_NUMBERS: AvailablePhoneNumber[] = [
  {
    phoneNumber: "+15715550184",
    friendlyName: "(571) 555-0184",
    locality: "Woodbridge",
    region: "VA",
    type: "local",
    capabilities: { sms: true, mms: true, voice: true },
    monthlyCost: 1.15,
  },
  {
    phoneNumber: "+17035550192",
    friendlyName: "(703) 555-0192",
    locality: "Arlington",
    region: "VA",
    type: "local",
    capabilities: { sms: true, mms: true, voice: false },
    monthlyCost: 1.15,
  },
  {
    phoneNumber: "+12025550133",
    friendlyName: "(202) 555-0133",
    locality: "Washington",
    region: "DC",
    type: "local",
    capabilities: { sms: true, mms: false, voice: true },
    monthlyCost: 1.25,
  },
  {
    phoneNumber: "+18005550167",
    friendlyName: "(800) 555-0167",
    locality: "Toll-Free",
    region: "US",
    type: "toll_free",
    capabilities: { sms: true, mms: true, voice: true },
    monthlyCost: 2.15,
  },
  {
    phoneNumber: "+15715550108",
    friendlyName: "(571) 555-0108",
    locality: "Manassas",
    region: "VA",
    type: "local",
    capabilities: { sms: true, mms: true, voice: true },
    monthlyCost: 1.15,
  },
];

/** ZIP → locality hints for mock number search. */
const MOCK_ZIP_LOCALITIES: Record<string, string[]> = {
  "22191": ["woodbridge"],
  "22201": ["arlington"],
  "20001": ["washington"],
  "20110": ["manassas"],
};

export type MockSubmitResult = {
  registration: MessagingRegistration;
  events: Array<{ eventType: string; message: string; payload?: Record<string, unknown> }>;
};

/** Simulate Twilio ISV chain after customer submits the application. */
export function mockSubmitRegistration(reg: MessagingRegistration): MockSubmitResult {
  const now = new Date().toISOString();
  const next: MessagingRegistration = {
    ...reg,
    submittedAt: now,
    overallStatus: "in_review",
    businessDetailsStatus: "in_review",
    useCaseStatus: "submitted",
    brandVerificationStatus: "in_review",
    campaignReviewStatus: "not_started",
    setupStep: "status",
    twilio: {
      ...reg.twilio,
      subaccountSid: reg.twilio.subaccountSid ?? sid("ACmock"),
      customerProfileSid: sid("BUmock"),
      customerProfileStatus: "pending-review",
      businessEndUserSid: sid("ITmock"),
      authorizedRepEndUserSid: sid("ITmock"),
      addressSid: sid("ADmock"),
      profileEvaluationStatus: "pending-review",
      profileSubmittedAt: now,
      brandSid: sid("BNmock"),
      brandStatus: "PENDING",
      brandIdentityStatus: "pending",
      campaignUseCase: reg.useCase.campaignUseCase,
    },
    lastStatusCheckedAt: now,
    updatedAt: now,
  };

  return {
    registration: next,
    events: [
      {
        eventType: "registration_submitted",
        message: "Application submitted for business verification and brand registration.",
      },
      {
        eventType: "subaccount_created",
        message: "Mock Twilio subaccount created for this customer.",
        payload: { sid: next.twilio.subaccountSid },
      },
      {
        eventType: "customer_profile_submitted",
        message: "Secondary Customer Profile submitted (mock).",
        payload: { sid: next.twilio.customerProfileSid },
      },
    ],
  };
}

/** Advance mock approvals one stage at a time for status polling. */
export function mockReconcileStatus(reg: MessagingRegistration): MockSubmitResult {
  const now = new Date().toISOString();
  const events: MockSubmitResult["events"] = [];
  const next: MessagingRegistration = {
    ...reg,
    lastStatusCheckedAt: now,
    updatedAt: now,
    twilio: { ...reg.twilio },
  };

  if (next.businessDetailsStatus === "in_review") {
    next.businessDetailsStatus = "approved";
    next.twilio.customerProfileStatus = "twilio-approved";
    next.twilio.profileEvaluationStatus = "compliant";
    next.twilio.profileApprovedAt = now;
    events.push({
      eventType: "customer_profile_approved",
      message: "Business profile approved.",
    });
  } else if (next.brandVerificationStatus === "in_review") {
    next.brandVerificationStatus = "approved";
    next.twilio.brandStatus = "APPROVED";
    next.twilio.brandIdentityStatus = "verified";
    next.brandEmailVerificationStatus = "verified";
    events.push({
      eventType: "brand_approved",
      message: "Brand registration approved.",
    });
    next.campaignReviewStatus = "in_review";
    next.twilio.campaignSid = next.twilio.campaignSid ?? sid("QEmock");
    next.twilio.campaignStatus = "IN_REVIEW";
    next.twilio.campaignSubmittedAt = now;
    events.push({
      eventType: "campaign_submitted",
      message: "A2P campaign submitted for review.",
    });
  } else if (next.campaignReviewStatus === "in_review") {
    next.campaignReviewStatus = "approved";
    next.twilio.campaignStatus = "VERIFIED";
    next.twilio.campaignApprovedAt = now;
    next.useCaseStatus = "approved";
    events.push({
      eventType: "campaign_approved",
      message: "Messaging campaign approved.",
    });
    if (next.phoneNumberReserved && next.phoneNumberE164) {
      next.messagingStatus = "ready";
      next.messagingEnabled = true;
      next.overallStatus = "ready";
      next.setupStep = "ready";
      next.twilio.messagingServiceSid = next.twilio.messagingServiceSid ?? sid("MGmock");
      events.push({
        eventType: "messaging_enabled",
        message: "Messaging activated on reserved number.",
      });
    } else {
      next.overallStatus = "approved";
      next.numberStatus = "not_started";
    }
  }

  return { registration: next, events };
}

export function mockSearchNumbers(params: {
  areaCode?: string;
  city?: string;
  postalCode?: string;
  contains?: string;
}): AvailablePhoneNumber[] {
  const area = (params.areaCode ?? "").replace(/\D/g, "");
  const city = (params.city ?? "").trim().toLowerCase();
  const postal = (params.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  const contains = (params.contains ?? "").replace(/\D/g, "");
  const zipLocalities = postal ? MOCK_ZIP_LOCALITIES[postal] ?? [] : [];
  return MOCK_PHONE_NUMBERS.filter((row) => {
    if (area && !row.phoneNumber.includes(area)) return false;
    if (city && !`${row.locality} ${row.region}`.toLowerCase().includes(city)) return false;
    if (
      zipLocalities.length > 0 &&
      !zipLocalities.some((name) => row.locality.toLowerCase().includes(name))
    ) {
      return false;
    }
    if (contains && !row.phoneNumber.replace(/\D/g, "").includes(contains)) return false;
    return true;
  });
}

export function mockPurchaseNumber(
  reg: MessagingRegistration,
  number: AvailablePhoneNumber
): MockSubmitResult {
  const now = new Date().toISOString();
  const campaignApproved = reg.campaignReviewStatus === "approved";
  const hasService = Boolean(reg.twilio.messagingServiceSid);
  const next: MessagingRegistration = {
    ...reg,
    phoneNumberE164: number.phoneNumber,
    phoneNumberFriendly: number.friendlyName,
    phoneNumberLocality: number.locality,
    phoneNumberRegion: number.region,
    phoneNumberMonthlyCost: number.monthlyCost,
    phoneNumberCapabilities: number.capabilities,
    phoneNumberReserved: true,
    phoneNumberPurchasedAt: now,
    numberStatus: campaignApproved ? "approved" : "submitted",
    twilio: {
      ...reg.twilio,
      phoneNumberSid: sid("PNmock"),
      messagingServiceSid: reg.twilio.messagingServiceSid,
      phoneNumberAttached: hasService,
      phoneNumberAttachedAt: hasService ? now : null,
    },
    messagingEnabled: campaignApproved && hasService,
    messagingStatus: campaignApproved && hasService ? "ready" : "not_started",
    overallStatus: campaignApproved && hasService ? "ready" : reg.overallStatus,
    setupStep: campaignApproved && hasService ? "ready" : "number",
    updatedAt: now,
    lastStatusCheckedAt: now,
  };

  return {
    registration: next,
    events: [
      {
        eventType: "number_purchased",
        message: campaignApproved
          ? `Phone number ${number.friendlyName} purchased. Texting is ready.`
          : `Phone number ${number.friendlyName} purchased. It will become available for texting after A2P registration is approved.`,
        payload: { phoneNumber: number.phoneNumber, monthlyCost: number.monthlyCost },
      },
    ],
  };
}
