export type MessagingAdapterMode = "mock" | "twilio";

export type CustomerFacingStatus =
  | "not_started"
  | "action_required"
  | "submitted"
  | "in_review"
  | "approved"
  | "failed"
  | "suspended"
  | "ready";

export type SetupStep =
  | "overview"
  | "business"
  | "use_case"
  | "review"
  | "status"
  | "number"
  | "ready";

export type BusinessIdentity =
  | "private"
  | "public"
  | "nonprofit"
  | "government"
  | "sole_proprietor";

export type ProgressStepId =
  | "business_details"
  | "messaging_use_case"
  | "brand_verification"
  | "campaign_review"
  | "choose_number"
  | "ready_to_text";

export type MessagingBusinessForm = {
  legalBusinessName: string;
  dbaName: string;
  businessType: string;
  ein: string;
  registrationCountry: string;
  businessIndustry: string;
  websiteUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  regionsOfOperation: string[];
  businessIdentity: BusinessIdentity | "";
  authRepFullName: string;
  authRepJobTitle: string;
  authRepEmail: string;
  authRepPhone: string;
  authRepRole: string;
  brandContactEmail: string;
  certAuthorized: boolean;
  certAccurate: boolean;
  certUnderstandsDelays: boolean;
};

export type MessagingUseCaseForm = {
  campaignUseCase: string;
  campaignDescription: string;
  optInMethod: string;
  optInLanguage: string;
  consentPageUrl: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  optOutWording: string;
  helpWording: string;
  expectedMonthlyVolume: number | null;
  messagesIncludeLinks: boolean;
  messagesIncludePhoneNumbers: boolean;
  messagingRecurring: boolean;
  customerCanInitiate: boolean;
  restrictedContent: boolean;
  sampleMessages: string[];
};

export type AvailablePhoneNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  type: "local" | "toll_free";
  capabilities: { sms: boolean; mms: boolean; voice: boolean };
  monthlyCost: number;
};

export type MessagingRegistrationEvent = {
  id: string;
  eventType: string;
  source: string;
  message: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type MessagingRegistration = {
  id: string;
  organizationId: string;
  businessId: string;
  businessName: string;
  setupStep: SetupStep;
  overallStatus: CustomerFacingStatus;
  businessDetailsStatus: CustomerFacingStatus;
  useCaseStatus: CustomerFacingStatus;
  brandVerificationStatus: CustomerFacingStatus;
  campaignReviewStatus: CustomerFacingStatus;
  numberStatus: CustomerFacingStatus;
  messagingStatus: CustomerFacingStatus;
  business: MessagingBusinessForm;
  useCase: MessagingUseCaseForm;
  brandType: string;
  brandEmailVerificationStatus: string;
  phoneNumberE164: string | null;
  phoneNumberFriendly: string | null;
  phoneNumberLocality: string | null;
  phoneNumberRegion: string | null;
  phoneNumberMonthlyCost: number | null;
  phoneNumberCapabilities: Record<string, boolean>;
  phoneNumberReserved: boolean;
  messagingEnabled: boolean;
  messagingPaused: boolean;
  monthlySmsAllowance: number;
  monthlySmsUsed: number;
  adapterMode: MessagingAdapterMode;
  submittedAt: string | null;
  lastStatusCheckedAt: string | null;
  lastError: string | null;
  adminNotes: string | null;
  twilio: {
    subaccountSid: string | null;
    customerProfileSid: string | null;
    customerProfileStatus: string | null;
    businessEndUserSid: string | null;
    authorizedRepEndUserSid: string | null;
    addressSid: string | null;
    supportingDocumentSid: string | null;
    profileEvaluationStatus: string | null;
    profileFailureReasons: string[];
    profileSubmittedAt: string | null;
    profileApprovedAt: string | null;
    brandSid: string | null;
    brandStatus: string | null;
    brandFailureReason: string | null;
    brandIdentityStatus: string | null;
    campaignSid: string | null;
    campaignStatus: string | null;
    campaignFailureReason: string | null;
    campaignUseCase: string | null;
    campaignSubmittedAt: string | null;
    campaignApprovedAt: string | null;
    messagingServiceSid: string | null;
    phoneNumberSid: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type MessagingProgressStep = {
  id: ProgressStepId;
  label: string;
  status: CustomerFacingStatus;
  href: string;
};

export const EMPTY_BUSINESS_FORM: MessagingBusinessForm = {
  legalBusinessName: "",
  dbaName: "",
  businessType: "",
  ein: "",
  registrationCountry: "US",
  businessIndustry: "",
  websiteUrl: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  regionsOfOperation: [],
  businessIdentity: "",
  authRepFullName: "",
  authRepJobTitle: "",
  authRepEmail: "",
  authRepPhone: "",
  authRepRole: "",
  brandContactEmail: "",
  certAuthorized: false,
  certAccurate: false,
  certUnderstandsDelays: false,
};

export const EMPTY_USE_CASE_FORM: MessagingUseCaseForm = {
  campaignUseCase: "CUSTOMER_CARE",
  campaignDescription: "",
  optInMethod: "",
  optInLanguage: "",
  consentPageUrl: "",
  privacyPolicyUrl: "",
  termsUrl: "",
  optOutWording: "Reply STOP to opt out.",
  helpWording: "Reply HELP for help.",
  expectedMonthlyVolume: 300,
  messagesIncludeLinks: true,
  messagesIncludePhoneNumbers: false,
  messagingRecurring: false,
  customerCanInitiate: false,
  restrictedContent: false,
  sampleMessages: [],
};
