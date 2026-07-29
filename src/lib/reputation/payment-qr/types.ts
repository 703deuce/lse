export const PAYMENT_PROVIDERS = ["venmo", "cash_app", "paypal", "zelle"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PURPOSES = [
  "pay",
  "tip",
  "donate",
  "pay_invoice",
  "leave_deposit",
  "support_us",
  "custom",
] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  pay: "Pay",
  tip: "Tip",
  donate: "Donate",
  pay_invoice: "Pay invoice",
  leave_deposit: "Leave deposit",
  support_us: "Support us",
  custom: "Custom",
};

export const PAYMENT_PURPOSE_HEADINGS: Record<PaymentPurpose, string> = {
  pay: "Pay",
  tip: "Leave a tip",
  donate: "Donate",
  pay_invoice: "Pay your invoice",
  leave_deposit: "Leave a deposit",
  support_us: "Support us",
  custom: "Pay or tip",
};

export const QR_EVENT_TYPES = [
  "page_view",
  "qr_scan",
  "payment_option_viewed",
  "payment_option_clicked",
  "external_payment_returned",
  "review_prompt_viewed",
  "google_review_clicked",
  "facebook_review_clicked",
  "social_link_clicked",
  "qr_downloaded",
  "poster_downloaded",
  "stripe_checkout_started",
  "stripe_payment_completed",
  "stripe_payment_failed",
] as const;
export type QrEventType = (typeof QR_EVENT_TYPES)[number];

export const PAYMENT_MODES = ["reusable_page", "request_only"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  reusable_page: "Reusable payment page",
  request_only: "Payment request template",
};

export type PaymentProviderCapabilities = {
  supportsPrefilledAmount: boolean;
  supportsPrefilledNote: boolean;
  supportsAppDeepLink: boolean;
  supportsWebFallback: boolean;
  supportsVerifiedCompletion: boolean;
};

export type PaymentRequestSession = {
  id: string;
  qrCampaignId: string;
  organizationId: string | null;
  businessId: string | null;
  shortCode: string;
  amountCents: number;
  currency: string;
  note: string | null;
  status: "active" | "expired" | "cancelled";
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentPageLoadContext = {
  campaign: import("@/lib/reputation/qr-campaigns/types").ReviewQrCampaign;
  config: PaymentPageConfiguration;
  paymentMode: PaymentMode;
  /** Locked amount for transaction-specific requests */
  requestSession: PaymentRequestSession | null;
};

export type PaymentPageMethod = {
  id: string;
  provider: PaymentProvider;
  publicHandle: string | null;
  publicUrl: string | null;
  instructions: string | null;
  uploadedQrImageUrl: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type PaymentSuggestedAmount = {
  id: string;
  amountCents: number;
  label: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type PaymentPageConfiguration = {
  id: string;
  qrCampaignId: string;
  paymentMode: PaymentMode;
  purpose: PaymentPurpose;
  customPurposeLabel: string | null;
  title: string | null;
  description: string | null;
  thankYouMessage: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  allowCustomAmount: boolean;
  showReviewPrompt: boolean;
  showPlatformBranding: boolean;
  googleReviewUrl: string | null;
  facebookReviewUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  phone: string | null;
  email: string | null;
  methods: PaymentPageMethod[];
  suggestedAmounts: PaymentSuggestedAmount[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentQrAnalytics = {
  pageViews: number;
  uniqueVisitors: number;
  qrScans: number;
  paymentOptionClicks: number;
  providerClicks: Record<string, number>;
  amountSelections: Record<number, number>;
  externalPaymentReturns: number;
  reviewPromptViews: number;
  googleReviewClicks: number;
  facebookReviewClicks: number;
  qrDownloads: number;
  posterDownloads: number;
  verifiedStripePayments: number;
  verifiedStripeAmountCents: number;
  conversionRates: {
    scanToPageView: number | null;
    pageViewToPaymentClick: number | null;
    paymentClickToReturn: number | null;
    returnToReviewClick: number | null;
    pageViewToReviewClick: number | null;
  };
  recentActivity: Array<{
    id: string;
    eventType: string;
    provider: string | null;
    amountSelectedCents: number | null;
    createdAt: string;
    deviceCategory: string | null;
  }>;
};

export type CreatePaymentQrInput = {
  organizationId: string;
  businessId: string;
  ownerUserId?: string | null;
  name: string;
  placementType?: string;
  publicSlug?: string | null;
  purpose: PaymentPurpose;
  customPurposeLabel?: string | null;
  title?: string | null;
  description?: string | null;
  thankYouMessage?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string | null;
  allowCustomAmount?: boolean;
  showReviewPrompt?: boolean;
  showPlatformBranding?: boolean;
  googleReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  methods: Array<{
    provider: PaymentProvider;
    publicHandle?: string | null;
    publicUrl?: string | null;
    instructions?: string | null;
    uploadedQrImageUrl?: string | null;
    enabled?: boolean;
    sortOrder?: number;
  }>;
  suggestedAmounts?: Array<{
    amountCents: number;
    label?: string | null;
    enabled?: boolean;
    sortOrder?: number;
  }>;
  headline?: string;
  brandColor?: string;
  templateKey?: string;
  printFormat?: "a4" | "a5" | "letter";
  showFooter?: boolean;
  posterConfig?: Record<string, unknown>;
  status?: "active" | "paused" | "draft";
  paymentMode?: PaymentMode;
};

export type CreatePaymentRequestInput = {
  organizationId: string;
  businessId: string;
  qrCampaignId: string;
  ownerUserId?: string | null;
  amountCents: number;
  currency?: string;
  note?: string | null;
  expiresInDays?: number;
};
