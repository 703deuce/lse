import type { MessagingUseCaseForm } from "./types";

export const DEFAULT_REVIEW_CAMPAIGN_DESCRIPTION = `Customers receive a one-time follow-up text after receiving a service from the business. The message thanks the customer and provides a link where they may leave feedback or a Google review. Messages are sent only to customers who provided their phone number and consented to receive service-related follow-up communication.`;

export const DEFAULT_OPT_IN_LANGUAGE = `By providing your phone number, you agree to receive service-related follow-up texts from {{business_name}}, including an optional request for feedback or a Google review. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.`;

export function defaultSampleMessages(businessName = "{{business_name}}"): string[] {
  return [
    `Hi {{first_name}}, thanks for choosing ${businessName}. We’d appreciate your feedback: {{review_link}}. Reply STOP to opt out.`,
    `Hi {{first_name}}, this is ${businessName} following up after your recent service. Would you mind sharing your experience? {{review_link}} Reply STOP to opt out.`,
    `Hi {{first_name}}, thanks again for trusting ${businessName}. If you have a moment, leave a quick review here: {{review_link}}. Reply HELP for help, STOP to opt out.`,
  ];
}

export function defaultUseCaseForm(businessName?: string): MessagingUseCaseForm {
  return {
    campaignUseCase: "CUSTOMER_CARE",
    campaignDescription: DEFAULT_REVIEW_CAMPAIGN_DESCRIPTION,
    optInMethod: "Verbal + written consent at booking / invoice",
    optInLanguage: DEFAULT_OPT_IN_LANGUAGE.replaceAll("{{business_name}}", businessName || "{{business_name}}"),
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
    sampleMessages: defaultSampleMessages(businessName || "{{business_name}}"),
  };
}
