import type {
  PaymentPageConfiguration,
  PaymentPageMethod,
  PaymentSuggestedAmount,
  PaymentPurpose,
  PaymentProvider,
} from "./types";

export function rowToPaymentMethod(row: Record<string, unknown>): PaymentPageMethod {
  return {
    id: String(row.id),
    provider: String(row.provider) as PaymentProvider,
    publicHandle: row.public_handle ? String(row.public_handle) : null,
    publicUrl: row.public_url ? String(row.public_url) : null,
    instructions: row.instructions ? String(row.instructions) : null,
    uploadedQrImageUrl: row.uploaded_qr_image_url ? String(row.uploaded_qr_image_url) : null,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToSuggestedAmount(row: Record<string, unknown>): PaymentSuggestedAmount {
  return {
    id: String(row.id),
    amountCents: Number(row.amount_cents ?? 0),
    label: row.label ? String(row.label) : null,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToPaymentConfig(
  row: Record<string, unknown>,
  methods: PaymentPageMethod[] = [],
  suggestedAmounts: PaymentSuggestedAmount[] = []
): PaymentPageConfiguration {
  return {
    id: String(row.id),
    qrCampaignId: String(row.qr_campaign_id),
    purpose: String(row.purpose ?? "pay") as PaymentPurpose,
    customPurposeLabel: row.custom_purpose_label ? String(row.custom_purpose_label) : null,
    title: row.title ? String(row.title) : null,
    description: row.description ? String(row.description) : null,
    thankYouMessage: row.thank_you_message ? String(row.thank_you_message) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    bannerUrl: row.banner_url ? String(row.banner_url) : null,
    primaryColor: String(row.primary_color ?? "#2563EB"),
    secondaryColor: row.secondary_color ? String(row.secondary_color) : null,
    allowCustomAmount: row.allow_custom_amount !== false,
    showReviewPrompt: Boolean(row.show_review_prompt),
    showPlatformBranding: row.show_platform_branding !== false,
    googleReviewUrl: row.google_review_url ? String(row.google_review_url) : null,
    facebookReviewUrl: row.facebook_review_url ? String(row.facebook_review_url) : null,
    websiteUrl: row.website_url ? String(row.website_url) : null,
    instagramUrl: row.instagram_url ? String(row.instagram_url) : null,
    tiktokUrl: row.tiktok_url ? String(row.tiktok_url) : null,
    youtubeUrl: row.youtube_url ? String(row.youtube_url) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    methods,
    suggestedAmounts,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
