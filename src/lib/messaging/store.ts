import { createServiceClient } from "@/lib/db/client";
import { defaultUseCaseForm } from "./defaults";
import { isLiveTwilioMessaging } from "./twilio-config";
import {
  EMPTY_BUSINESS_FORM,
  EMPTY_USE_CASE_FORM,
  type CustomerFacingStatus,
  type MessagingBusinessForm,
  type MessagingRegistration,
  type MessagingRegistrationEvent,
  type MessagingUseCaseForm,
  type SetupStep,
} from "./types";

type MemoryBag = {
  registrations: Map<string, MessagingRegistration>;
  events: Map<string, MessagingRegistrationEvent[]>;
  /** Encrypted subaccount auth tokens — never returned to the browser. */
  subaccountAuthTokens: Map<string, string>;
};

function memory(): MemoryBag {
  const g = globalThis as typeof globalThis & { __lseMessagingStore?: MemoryBag };
  if (!g.__lseMessagingStore) {
    g.__lseMessagingStore = {
      registrations: new Map(),
      events: new Map(),
      subaccountAuthTokens: new Map(),
    };
  } else if (!g.__lseMessagingStore.subaccountAuthTokens) {
    g.__lseMessagingStore.subaccountAuthTokens = new Map();
  }
  return g.__lseMessagingStore;
}

function emptyTwilioState(): MessagingRegistration["twilio"] {
  return {
    subaccountSid: null,
    subaccountStatus: null,
    subaccountCreatedAt: null,
    customerProfileSid: null,
    customerProfileStatus: null,
    businessEndUserSid: null,
    authorizedRepEndUserSid: null,
    authorizedRep2EndUserSid: null,
    addressSid: null,
    supportingDocumentSid: null,
    profileEvaluationSid: null,
    profileEvaluationStatus: null,
    profileFailureReasons: [],
    profileSubmittedAt: null,
    profileApprovedAt: null,
    a2pTrustProductSid: null,
    a2pEndUserSid: null,
    a2pEvaluationSid: null,
    a2pTrustProductStatus: null,
    a2pFailureReasons: [],
    brandSid: null,
    brandStatus: null,
    brandFailureReason: null,
    brandIdentityStatus: null,
    brandSubmittedAt: null,
    brandApprovedAt: null,
    campaignSid: null,
    campaignStatus: null,
    campaignFailureReason: null,
    campaignUseCase: null,
    campaignSubmittedAt: null,
    campaignApprovedAt: null,
    messagingServiceSid: null,
    phoneNumberSid: null,
    phoneNumberAttached: false,
    phoneNumberAttachedAt: null,
  };
}

function isMissingRelation(message: string): boolean {
  return /relation .*messaging_registrations|schema cache|does not exist/i.test(message);
}

function rowToRegistration(
  row: Record<string, unknown>,
  businessName: string
): MessagingRegistration {
  const sampleMessages = Array.isArray(row.sample_messages)
    ? (row.sample_messages as string[])
    : [];
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    businessId: String(row.business_id),
    businessName,
    setupStep: (row.setup_step as SetupStep) ?? "overview",
    overallStatus: (row.overall_status as CustomerFacingStatus) ?? "not_started",
    businessDetailsStatus: (row.business_details_status as CustomerFacingStatus) ?? "not_started",
    useCaseStatus: (row.use_case_status as CustomerFacingStatus) ?? "not_started",
    brandVerificationStatus:
      (row.brand_verification_status as CustomerFacingStatus) ?? "not_started",
    campaignReviewStatus: (row.campaign_review_status as CustomerFacingStatus) ?? "not_started",
    numberStatus: (row.number_status as CustomerFacingStatus) ?? "not_started",
    messagingStatus: (row.messaging_status as CustomerFacingStatus) ?? "not_started",
    business: {
      legalBusinessName: String(row.legal_business_name ?? ""),
      dbaName: String(row.dba_name ?? ""),
      businessType: String(row.business_type ?? ""),
      ein: String(row.ein ?? ""),
      registrationCountry: String(row.registration_country ?? "US"),
      businessIndustry: String(row.business_industry ?? ""),
      websiteUrl: String(row.website_url ?? ""),
      addressLine1: String(row.business_address_line1 ?? ""),
      addressLine2: String(row.business_address_line2 ?? ""),
      city: String(row.business_city ?? ""),
      region: String(row.business_region ?? ""),
      postalCode: String(row.business_postal_code ?? ""),
      regionsOfOperation: Array.isArray(row.regions_of_operation)
        ? (row.regions_of_operation as string[])
        : [],
      businessIdentity: (row.business_identity as MessagingBusinessForm["businessIdentity"]) ?? "",
      authRepFullName: String(row.auth_rep_full_name ?? ""),
      authRepJobTitle: String(row.auth_rep_job_title ?? ""),
      authRepEmail: String(row.auth_rep_email ?? ""),
      authRepPhone: String(row.auth_rep_phone ?? ""),
      authRepRole: String(row.auth_rep_role ?? ""),
      brandContactEmail: String(row.brand_contact_email ?? ""),
      certAuthorized: Boolean(row.cert_authorized),
      certAccurate: Boolean(row.cert_accurate),
      certUnderstandsDelays: Boolean(row.cert_understands_delays),
    },
    useCase: {
      campaignUseCase: String(row.campaign_use_case ?? "CUSTOMER_CARE"),
      campaignDescription: String(row.campaign_description ?? ""),
      optInMethod: String(row.opt_in_method ?? ""),
      optInLanguage: String(row.opt_in_language ?? ""),
      consentPageUrl: String(row.consent_page_url ?? ""),
      privacyPolicyUrl: String(row.privacy_policy_url ?? ""),
      termsUrl: String(row.terms_url ?? ""),
      optOutWording: String(row.opt_out_wording ?? "Reply STOP to opt out."),
      helpWording: String(row.help_wording ?? "Reply HELP for help."),
      expectedMonthlyVolume:
        row.expected_monthly_volume == null ? null : Number(row.expected_monthly_volume),
      messagesIncludeLinks: Boolean(row.messages_include_links ?? true),
      messagesIncludePhoneNumbers: Boolean(row.messages_include_phone_numbers),
      messagingRecurring: Boolean(row.messaging_recurring),
      customerCanInitiate: Boolean(row.customer_can_initiate),
      restrictedContent: Boolean(row.restricted_content),
      sampleMessages,
    },
    brandType: String(row.brand_type ?? "LOW_VOLUME"),
    brandEmailVerificationStatus: String(row.brand_email_verification_status ?? "not_started"),
    phoneNumberE164: row.phone_number_e164 ? String(row.phone_number_e164) : null,
    phoneNumberFriendly: row.phone_number_friendly ? String(row.phone_number_friendly) : null,
    phoneNumberLocality: row.phone_number_locality ? String(row.phone_number_locality) : null,
    phoneNumberRegion: row.phone_number_region ? String(row.phone_number_region) : null,
    phoneNumberMonthlyCost:
      row.phone_number_monthly_cost == null ? null : Number(row.phone_number_monthly_cost),
    phoneNumberCapabilities:
      (row.phone_number_capabilities as Record<string, boolean>) ?? {},
    phoneNumberReserved: Boolean(row.phone_number_reserved),
    phoneNumberPurchasedAt: row.phone_number_purchased_at
      ? String(row.phone_number_purchased_at)
      : null,
    messagingEnabled: Boolean(row.messaging_enabled),
    messagingPaused: Boolean(row.messaging_paused),
    monthlySmsAllowance: Number(row.monthly_sms_allowance ?? 300),
    monthlySmsUsed: Number(row.monthly_sms_used ?? 0),
    adapterMode: row.adapter_mode === "twilio" ? "twilio" : "mock",
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    lastStatusCheckedAt: row.last_status_checked_at ? String(row.last_status_checked_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    adminNotes: row.admin_notes ? String(row.admin_notes) : null,
    twilio: {
      subaccountSid: row.twilio_subaccount_sid ? String(row.twilio_subaccount_sid) : null,
      subaccountStatus: row.twilio_subaccount_status ? String(row.twilio_subaccount_status) : null,
      subaccountCreatedAt: row.twilio_subaccount_created_at
        ? String(row.twilio_subaccount_created_at)
        : null,
      customerProfileSid: row.twilio_customer_profile_sid
        ? String(row.twilio_customer_profile_sid)
        : null,
      customerProfileStatus: row.twilio_customer_profile_status
        ? String(row.twilio_customer_profile_status)
        : null,
      businessEndUserSid: row.twilio_business_end_user_sid
        ? String(row.twilio_business_end_user_sid)
        : null,
      authorizedRepEndUserSid: row.twilio_authorized_rep_end_user_sid
        ? String(row.twilio_authorized_rep_end_user_sid)
        : null,
      authorizedRep2EndUserSid: row.twilio_rep_2_end_user_sid
        ? String(row.twilio_rep_2_end_user_sid)
        : null,
      addressSid: row.twilio_address_sid ? String(row.twilio_address_sid) : null,
      supportingDocumentSid: row.twilio_supporting_document_sid
        ? String(row.twilio_supporting_document_sid)
        : null,
      profileEvaluationSid: row.twilio_profile_evaluation_sid
        ? String(row.twilio_profile_evaluation_sid)
        : null,
      profileEvaluationStatus: row.twilio_profile_evaluation_status
        ? String(row.twilio_profile_evaluation_status)
        : null,
      profileFailureReasons: Array.isArray(row.twilio_profile_failure_reasons)
        ? (row.twilio_profile_failure_reasons as string[])
        : [],
      profileSubmittedAt: row.twilio_profile_submitted_at
        ? String(row.twilio_profile_submitted_at)
        : null,
      profileApprovedAt: row.twilio_profile_approved_at
        ? String(row.twilio_profile_approved_at)
        : null,
      a2pTrustProductSid: row.twilio_a2p_trust_product_sid
        ? String(row.twilio_a2p_trust_product_sid)
        : null,
      a2pEndUserSid: row.twilio_a2p_end_user_sid ? String(row.twilio_a2p_end_user_sid) : null,
      a2pEvaluationSid: row.twilio_a2p_evaluation_sid
        ? String(row.twilio_a2p_evaluation_sid)
        : null,
      a2pTrustProductStatus: row.twilio_a2p_trust_product_status
        ? String(row.twilio_a2p_trust_product_status)
        : null,
      a2pFailureReasons: Array.isArray(row.twilio_a2p_failure_reasons)
        ? (row.twilio_a2p_failure_reasons as string[])
        : [],
      brandSid: row.twilio_brand_sid ? String(row.twilio_brand_sid) : null,
      brandStatus: row.twilio_brand_status ? String(row.twilio_brand_status) : null,
      brandFailureReason: row.twilio_brand_failure_reason
        ? String(row.twilio_brand_failure_reason)
        : null,
      brandIdentityStatus: row.twilio_brand_identity_status
        ? String(row.twilio_brand_identity_status)
        : null,
      brandSubmittedAt: row.twilio_brand_submitted_at
        ? String(row.twilio_brand_submitted_at)
        : null,
      brandApprovedAt: row.twilio_brand_approved_at
        ? String(row.twilio_brand_approved_at)
        : null,
      campaignSid: row.twilio_campaign_sid ? String(row.twilio_campaign_sid) : null,
      campaignStatus: row.twilio_campaign_status ? String(row.twilio_campaign_status) : null,
      campaignFailureReason: row.twilio_campaign_failure_reason
        ? String(row.twilio_campaign_failure_reason)
        : null,
      campaignUseCase: row.twilio_campaign_use_case ? String(row.twilio_campaign_use_case) : null,
      campaignSubmittedAt: row.twilio_campaign_submitted_at
        ? String(row.twilio_campaign_submitted_at)
        : null,
      campaignApprovedAt: row.twilio_campaign_approved_at
        ? String(row.twilio_campaign_approved_at)
        : null,
      messagingServiceSid: row.twilio_messaging_service_sid
        ? String(row.twilio_messaging_service_sid)
        : null,
      phoneNumberSid: row.twilio_phone_number_sid ? String(row.twilio_phone_number_sid) : null,
      phoneNumberAttached: Boolean(row.twilio_phone_number_attached),
      phoneNumberAttachedAt: row.twilio_phone_number_attached_at
        ? String(row.twilio_phone_number_attached_at)
        : null,
    },
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function registrationToPatch(reg: MessagingRegistration): Record<string, unknown> {
  return {
    setup_step: reg.setupStep,
    overall_status: reg.overallStatus,
    business_details_status: reg.businessDetailsStatus,
    use_case_status: reg.useCaseStatus,
    brand_verification_status: reg.brandVerificationStatus,
    campaign_review_status: reg.campaignReviewStatus,
    number_status: reg.numberStatus,
    messaging_status: reg.messagingStatus,
    legal_business_name: reg.business.legalBusinessName,
    dba_name: reg.business.dbaName,
    business_type: reg.business.businessType,
    ein: reg.business.ein,
    registration_country: reg.business.registrationCountry,
    business_industry: reg.business.businessIndustry,
    website_url: reg.business.websiteUrl,
    business_address_line1: reg.business.addressLine1,
    business_address_line2: reg.business.addressLine2,
    business_city: reg.business.city,
    business_region: reg.business.region,
    business_postal_code: reg.business.postalCode,
    regions_of_operation: reg.business.regionsOfOperation,
    business_identity: reg.business.businessIdentity || null,
    auth_rep_full_name: reg.business.authRepFullName,
    auth_rep_job_title: reg.business.authRepJobTitle,
    auth_rep_email: reg.business.authRepEmail,
    auth_rep_phone: reg.business.authRepPhone,
    auth_rep_role: reg.business.authRepRole,
    brand_contact_email: reg.business.brandContactEmail,
    cert_authorized: reg.business.certAuthorized,
    cert_accurate: reg.business.certAccurate,
    cert_understands_delays: reg.business.certUnderstandsDelays,
    campaign_use_case: reg.useCase.campaignUseCase,
    campaign_description: reg.useCase.campaignDescription,
    opt_in_method: reg.useCase.optInMethod,
    opt_in_language: reg.useCase.optInLanguage,
    consent_page_url: reg.useCase.consentPageUrl,
    privacy_policy_url: reg.useCase.privacyPolicyUrl,
    terms_url: reg.useCase.termsUrl,
    opt_out_wording: reg.useCase.optOutWording,
    help_wording: reg.useCase.helpWording,
    expected_monthly_volume: reg.useCase.expectedMonthlyVolume,
    messages_include_links: reg.useCase.messagesIncludeLinks,
    messages_include_phone_numbers: reg.useCase.messagesIncludePhoneNumbers,
    messaging_recurring: reg.useCase.messagingRecurring,
    customer_can_initiate: reg.useCase.customerCanInitiate,
    restricted_content: reg.useCase.restrictedContent,
    sample_messages: reg.useCase.sampleMessages,
    brand_type: reg.brandType,
    brand_email_verification_status: reg.brandEmailVerificationStatus,
    phone_number_e164: reg.phoneNumberE164,
    phone_number_friendly: reg.phoneNumberFriendly,
    phone_number_locality: reg.phoneNumberLocality,
    phone_number_region: reg.phoneNumberRegion,
    phone_number_monthly_cost: reg.phoneNumberMonthlyCost,
    phone_number_capabilities: reg.phoneNumberCapabilities,
    phone_number_reserved: reg.phoneNumberReserved,
    phone_number_purchased_at: reg.phoneNumberPurchasedAt,
    messaging_enabled: reg.messagingEnabled,
    messaging_paused: reg.messagingPaused,
    monthly_sms_allowance: reg.monthlySmsAllowance,
    monthly_sms_used: reg.monthlySmsUsed,
    adapter_mode: reg.adapterMode,
    submitted_at: reg.submittedAt,
    last_status_checked_at: reg.lastStatusCheckedAt,
    last_error: reg.lastError,
    admin_notes: reg.adminNotes,
    twilio_subaccount_sid: reg.twilio.subaccountSid,
    twilio_subaccount_status: reg.twilio.subaccountStatus,
    twilio_subaccount_created_at: reg.twilio.subaccountCreatedAt,
    twilio_customer_profile_sid: reg.twilio.customerProfileSid,
    twilio_customer_profile_status: reg.twilio.customerProfileStatus,
    twilio_business_end_user_sid: reg.twilio.businessEndUserSid,
    twilio_authorized_rep_end_user_sid: reg.twilio.authorizedRepEndUserSid,
    twilio_rep_2_end_user_sid: reg.twilio.authorizedRep2EndUserSid,
    twilio_address_sid: reg.twilio.addressSid,
    twilio_supporting_document_sid: reg.twilio.supportingDocumentSid,
    twilio_profile_evaluation_sid: reg.twilio.profileEvaluationSid,
    twilio_profile_evaluation_status: reg.twilio.profileEvaluationStatus,
    twilio_profile_failure_reasons: reg.twilio.profileFailureReasons,
    twilio_profile_submitted_at: reg.twilio.profileSubmittedAt,
    twilio_profile_approved_at: reg.twilio.profileApprovedAt,
    twilio_a2p_trust_product_sid: reg.twilio.a2pTrustProductSid,
    twilio_a2p_end_user_sid: reg.twilio.a2pEndUserSid,
    twilio_a2p_evaluation_sid: reg.twilio.a2pEvaluationSid,
    twilio_a2p_trust_product_status: reg.twilio.a2pTrustProductStatus,
    twilio_a2p_failure_reasons: reg.twilio.a2pFailureReasons,
    twilio_brand_sid: reg.twilio.brandSid,
    twilio_brand_status: reg.twilio.brandStatus,
    twilio_brand_failure_reason: reg.twilio.brandFailureReason,
    twilio_brand_identity_status: reg.twilio.brandIdentityStatus,
    twilio_brand_submitted_at: reg.twilio.brandSubmittedAt,
    twilio_brand_approved_at: reg.twilio.brandApprovedAt,
    twilio_campaign_sid: reg.twilio.campaignSid,
    twilio_campaign_status: reg.twilio.campaignStatus,
    twilio_campaign_failure_reason: reg.twilio.campaignFailureReason,
    twilio_campaign_use_case: reg.twilio.campaignUseCase,
    twilio_campaign_submitted_at: reg.twilio.campaignSubmittedAt,
    twilio_campaign_approved_at: reg.twilio.campaignApprovedAt,
    twilio_messaging_service_sid: reg.twilio.messagingServiceSid,
    twilio_phone_number_sid: reg.twilio.phoneNumberSid,
    twilio_phone_number_attached: reg.twilio.phoneNumberAttached,
    twilio_phone_number_attached_at: reg.twilio.phoneNumberAttachedAt,
    updated_at: new Date().toISOString(),
  };
}

export function createEmptyRegistration(params: {
  organizationId: string;
  businessId: string;
  businessName: string;
}): MessagingRegistration {
  const now = new Date().toISOString();
  const useCase = defaultUseCaseForm(params.businessName);
  return {
    id: `mem_${params.businessId}`,
    organizationId: params.organizationId,
    businessId: params.businessId,
    businessName: params.businessName,
    setupStep: "overview",
    overallStatus: "not_started",
    businessDetailsStatus: "not_started",
    useCaseStatus: "not_started",
    brandVerificationStatus: "not_started",
    campaignReviewStatus: "not_started",
    numberStatus: "not_started",
    messagingStatus: "not_started",
    business: {
      ...EMPTY_BUSINESS_FORM,
      dbaName: params.businessName,
      legalBusinessName: params.businessName,
    },
    useCase: useCase.campaignDescription ? useCase : { ...EMPTY_USE_CASE_FORM, ...useCase },
    brandType: "LOW_VOLUME",
    brandEmailVerificationStatus: "not_started",
    phoneNumberE164: null,
    phoneNumberFriendly: null,
    phoneNumberLocality: null,
    phoneNumberRegion: null,
    phoneNumberMonthlyCost: null,
    phoneNumberCapabilities: {},
    phoneNumberReserved: false,
    phoneNumberPurchasedAt: null,
    messagingEnabled: false,
    messagingPaused: false,
    monthlySmsAllowance: 300,
    monthlySmsUsed: 0,
    adapterMode: isLiveTwilioMessaging() ? "twilio" : "mock",
    submittedAt: null,
    lastStatusCheckedAt: null,
    lastError: null,
    adminNotes: null,
    twilio: emptyTwilioState(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Read encrypted subaccount auth token (never send to clients). */
export async function getSubaccountAuthTokenEncrypted(
  businessId: string
): Promise<string | null> {
  const mem = memory().subaccountAuthTokens.get(businessId);
  if (mem) return mem;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("messaging_registrations")
      .select("twilio_subaccount_auth_token_encrypted")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) return null;
      throw new Error(error.message);
    }
    const value = data?.twilio_subaccount_auth_token_encrypted
      ? String(data.twilio_subaccount_auth_token_encrypted)
      : null;
    if (value) memory().subaccountAuthTokens.set(businessId, value);
    return value;
  } catch {
    return null;
  }
}

export async function setSubaccountAuthTokenEncrypted(
  businessId: string,
  encrypted: string,
  opts?: { organizationId?: string; registrationId?: string | null }
): Promise<void> {
  memory().subaccountAuthTokens.set(businessId, encrypted);
  if (opts?.registrationId?.startsWith("mem_")) return;
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("messaging_registrations")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!existing?.id) return;
    const { error } = await supabase
      .from("messaging_registrations")
      .update({
        twilio_subaccount_auth_token_encrypted: encrypted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error && !isMissingRelation(error.message)) {
      console.warn("[messaging] failed to persist encrypted subaccount token:", error.message);
    }
  } catch {
    /* memory-only */
  }
}

export async function getRegistration(params: {
  organizationId: string;
  businessId: string;
  businessName: string;
}): Promise<MessagingRegistration> {
  const mem = memory();
  const cached = mem.registrations.get(params.businessId);
  if (cached) return { ...cached, businessName: params.businessName };

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("messaging_registrations")
      .select("*")
      .eq("business_id", params.businessId)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) {
        const empty = createEmptyRegistration(params);
        mem.registrations.set(params.businessId, empty);
        return empty;
      }
      throw new Error(error.message);
    }
    if (!data) {
      const empty = createEmptyRegistration(params);
      return empty;
    }
    return rowToRegistration(data as Record<string, unknown>, params.businessName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingRelation(message) || /SUPABASE|URL and API key/i.test(message)) {
      const empty = createEmptyRegistration(params);
      mem.registrations.set(params.businessId, empty);
      return empty;
    }
    throw err;
  }
}

export async function saveRegistration(reg: MessagingRegistration): Promise<MessagingRegistration> {
  const next = { ...reg, updatedAt: new Date().toISOString() };
  memory().registrations.set(reg.businessId, next);

  try {
    const supabase = createServiceClient();
    const patch = registrationToPatch(next);
    const encrypted = memory().subaccountAuthTokens.get(reg.businessId);
    if (encrypted) {
      patch.twilio_subaccount_auth_token_encrypted = encrypted;
    }
    const { data: existing } = await supabase
      .from("messaging_registrations")
      .select("id")
      .eq("business_id", reg.businessId)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("messaging_registrations")
        .update(patch)
        .eq("id", existing.id);
      if (error) {
        if (isMissingRelation(error.message)) return next;
        throw new Error(error.message);
      }
      return { ...next, id: String(existing.id) };
    }

    const { data, error } = await supabase
      .from("messaging_registrations")
      .insert({
        organization_id: reg.organizationId,
        business_id: reg.businessId,
        ...patch,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingRelation(error.message)) return next;
      throw new Error(error.message);
    }
    const withId = { ...next, id: String(data.id) };
    memory().registrations.set(reg.businessId, withId);
    return withId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingRelation(message) || /SUPABASE|URL and API key/i.test(message)) {
      return next;
    }
    throw err;
  }
}

export async function appendEvents(
  reg: MessagingRegistration,
  events: Array<{ eventType: string; message: string; payload?: Record<string, unknown>; source?: string }>
): Promise<void> {
  if (!events.length) return;
  const mem = memory();
  const rows: MessagingRegistrationEvent[] = events.map((event, index) => ({
    id: `evt_${Date.now()}_${index}`,
    eventType: event.eventType,
    source: event.source ?? "system",
    message: event.message,
    payload: event.payload ?? {},
    createdAt: new Date().toISOString(),
  }));
  mem.events.set(reg.businessId, [...(mem.events.get(reg.businessId) ?? []), ...rows]);

  if (reg.id.startsWith("mem_")) return;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("messaging_registration_events").insert(
      rows.map((row) => ({
        registration_id: reg.id,
        organization_id: reg.organizationId,
        business_id: reg.businessId,
        event_type: row.eventType,
        source: row.source,
        message: row.message,
        payload: row.payload,
      }))
    );
    if (error && !isMissingRelation(error.message)) {
      console.warn("[messaging] event insert skipped:", error.message);
    }
  } catch {
    /* memory-only mode */
  }
}

export async function listEvents(businessId: string): Promise<MessagingRegistrationEvent[]> {
  const mem = memory().events.get(businessId) ?? [];
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("messaging_registration_events")
      .select("id, event_type, source, message, payload, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingRelation(error.message)) return mem.slice().reverse();
      throw new Error(error.message);
    }
    if (!data?.length) return mem.slice().reverse();
    return data.map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      source: String(row.source),
      message: row.message ? String(row.message) : null,
      payload: (row.payload as Record<string, unknown>) ?? {},
      createdAt: String(row.created_at),
    }));
  } catch {
    return mem.slice().reverse();
  }
}

export async function listAllRegistrations(): Promise<MessagingRegistration[]> {
  const memRows = Array.from(memory().registrations.values());
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("messaging_registrations")
      .select("*, businesses(name)")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isMissingRelation(error.message)) return memRows;
      throw new Error(error.message);
    }
    const dbRows = (data ?? []).map((row) => {
      const businessName =
        (row as { businesses?: { name?: string } }).businesses?.name ?? "Business";
      return rowToRegistration(row as Record<string, unknown>, businessName);
    });
    const byBusiness = new Map(dbRows.map((row) => [row.businessId, row]));
    for (const mem of memRows) {
      if (!byBusiness.has(mem.businessId)) byBusiness.set(mem.businessId, mem);
    }
    return Array.from(byBusiness.values());
  } catch {
    return memRows;
  }
}
