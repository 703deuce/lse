import { appUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/db/client";
import { DEFAULT_POSTER_CONFIG } from "@/lib/reputation/poster-config";
import { assertCanCreateQrCampaign } from "@/lib/reputation/qr-campaigns/limits";
import { rowToCampaign } from "@/lib/reputation/qr-campaigns/mapper";
import { resolveWritablePosterTemplateKey } from "@/lib/reputation/qr-campaigns/resolve-template-key";
import {
  generateShortCode,
} from "@/lib/reputation/qr-campaigns/security";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { categorizeUserAgent, detectBotOrPreview } from "@/lib/reputation/qr-campaigns/bot-filter";
import { hashIpForQrScan } from "@/lib/reputation/qr-campaigns/security";
import { getPaymentQrEntitlements } from "./entitlements";
import { rowToPaymentConfig, rowToPaymentMethod, rowToSuggestedAmount } from "./mapper";
import { validatePaymentMethodInput } from "./providers";
import type {
  CreatePaymentQrInput,
  PaymentPageConfiguration,
  PaymentQrAnalytics,
  PaymentProvider,
  QrEventType,
} from "./types";
import { PAYMENT_PURPOSE_HEADINGS } from "./types";

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

function isMissingTable(message: string): boolean {
  return /does not exist|schema cache|payment_page|review_qr_events/i.test(message);
}

async function allocateUniqueShortCodeLocal(): Promise<string> {
  const supabase = createServiceClient();
  for (let i = 0; i < 8; i++) {
    const code = generateShortCode();
    const { data } = await supabase
      .from("review_qr_campaigns")
      .select("id")
      .eq("short_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return generateShortCode(16);
}

export function buildPaymentPageUrl(slug: string): string {
  return appUrl(`/pay/${encodeURIComponent(slug)}`);
}

export function validatePublicSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_REGEX.test(normalized)) {
    throw new Error("Slug must be 2–50 lowercase letters, numbers, or hyphens.");
  }
  return normalized;
}

export async function countPaymentQrCampaigns(
  organizationId: string,
  businessId: string
): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("review_qr_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("campaign_type", "payment_review")
    .neq("status", "archived");
  return count ?? 0;
}

export async function getPaymentPageBySlug(slug: string): Promise<{
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
} | null> {
  const supabase = createServiceClient();
  const { data: campaignRow } = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .or(`public_slug.eq.${slug},short_code.eq.${slug}`)
    .eq("campaign_type", "payment_review")
    .maybeSingle();

  if (!campaignRow) return null;
  const campaign = rowToCampaign(campaignRow as Record<string, unknown>);
  if (campaign.status !== "active") return null;

  const config = await getPaymentConfigByCampaignId(campaign.id);
  if (!config) return null;
  return { campaign, config };
}

export async function getPaymentConfigByCampaignId(
  campaignId: string
): Promise<PaymentPageConfiguration | null> {
  const supabase = createServiceClient();
  const { data: configRow } = await supabase
    .from("payment_page_configurations")
    .select("*")
    .eq("qr_campaign_id", campaignId)
    .maybeSingle();
  if (!configRow) return null;

  const { data: methods } = await supabase
    .from("payment_page_methods")
    .select("*")
    .eq("payment_page_config_id", configRow.id)
    .order("sort_order", { ascending: true });

  const { data: amounts } = await supabase
    .from("payment_page_suggested_amounts")
    .select("*")
    .eq("payment_page_config_id", configRow.id)
    .order("sort_order", { ascending: true });

  return rowToPaymentConfig(
    configRow as Record<string, unknown>,
    (methods ?? []).map((m) => rowToPaymentMethod(m as Record<string, unknown>)),
    (amounts ?? []).map((a) => rowToSuggestedAmount(a as Record<string, unknown>))
  );
}

export async function createPaymentQrCampaign(
  input: CreatePaymentQrInput
): Promise<{ campaign: ReviewQrCampaign; config: PaymentPageConfiguration }> {
  const entitlements = await getPaymentQrEntitlements(input.organizationId);
  const existingCount = await countPaymentQrCampaigns(input.organizationId, input.businessId);
  if (existingCount >= entitlements.maxPages) {
    throw new Error(`Plan limit: maximum ${entitlements.maxPages} payment page(s).`);
  }

  if (input.showReviewPrompt && !entitlements.reviewLinks) {
    throw new Error("Upgrade required to enable review links on payment pages.");
  }
  if (input.publicSlug && !entitlements.customSlug) {
    throw new Error("Upgrade required for custom page slug.");
  }
  if ((input.suggestedAmounts?.length ?? 0) > 0 && !entitlements.suggestedAmounts) {
    throw new Error("Upgrade required for suggested payment amounts.");
  }

  const enabledMethods = input.methods.filter((m) => m.enabled !== false);
  if (enabledMethods.length === 0) {
    throw new Error("Enable at least one payment method.");
  }

  for (const method of enabledMethods) {
    const handle = method.publicHandle ?? method.publicUrl ?? "";
    const result = validatePaymentMethodInput(method.provider, handle);
    if (!result.ok) {
      throw new Error(`${method.provider}: ${result.error}`);
    }
  }

  const publicSlug = input.publicSlug
    ? validatePublicSlug(input.publicSlug)
    : null;

  if (publicSlug) {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("review_qr_campaigns")
      .select("id")
      .eq("public_slug", publicSlug)
      .maybeSingle();
    if (existing) throw new Error("This page slug is already in use.");
  }

  await assertCanCreateQrCampaign({
    organizationId: input.organizationId,
    businessId: input.businessId,
    activating: (input.status ?? "active") === "active",
  });

  const shortCode = await allocateUniqueShortCodeLocal();
  const slugForUrl = publicSlug ?? shortCode;
  const destinationUrl = buildPaymentPageUrl(slugForUrl);

  const purposeHeading =
    input.purpose === "custom" && input.customPurposeLabel
      ? input.customPurposeLabel
      : PAYMENT_PURPOSE_HEADINGS[input.purpose];

  const supabase = createServiceClient();
  const templateKey = await resolveWritablePosterTemplateKey({
    organizationId: input.organizationId,
    requested: input.templateKey,
  });

  const { data: campaignRow, error: campaignError } = await supabase
    .from("review_qr_campaigns")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      owner_user_id: input.ownerUserId ?? null,
      name: input.name.trim() || "Payment QR",
      placement_type: input.placementType ?? "standard_poster",
      destination_url: destinationUrl,
      short_code: shortCode,
      public_slug: publicSlug,
      campaign_type: "payment_review",
      headline: input.headline ?? purposeHeading,
      description: input.description ?? input.title ?? purposeHeading,
      brand_color: input.primaryColor ?? input.brandColor ?? "#2563EB",
      print_format: input.printFormat ?? "letter",
      show_footer: input.showFooter ?? true,
      template_key: templateKey,
      poster_config: input.posterConfig ?? {
        ...DEFAULT_POSTER_CONFIG,
        title: input.headline ?? purposeHeading,
        brandColor: input.primaryColor ?? "#2563EB",
      },
      status: input.status ?? "active",
      source: "app",
      claimed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (campaignError) throw new Error(campaignError.message);
  const campaign = rowToCampaign(campaignRow as Record<string, unknown>);

  const { data: configRow, error: configError } = await supabase
    .from("payment_page_configurations")
    .insert({
      qr_campaign_id: campaign.id,
      purpose: input.purpose,
      custom_purpose_label: input.customPurposeLabel ?? null,
      title: input.title ?? purposeHeading,
      description: input.description ?? null,
      thank_you_message: input.thankYouMessage ?? "Thank you for your support!",
      logo_url: input.logoUrl ?? null,
      banner_url: input.bannerUrl ?? null,
      primary_color: input.primaryColor ?? "#2563EB",
      secondary_color: input.secondaryColor ?? null,
      allow_custom_amount: input.allowCustomAmount ?? true,
      show_review_prompt: input.showReviewPrompt ?? false,
      show_platform_branding: input.showPlatformBranding ?? !entitlements.removePlatformBranding,
      google_review_url: input.googleReviewUrl ?? null,
      facebook_review_url: input.facebookReviewUrl ?? null,
      website_url: input.websiteUrl ?? null,
      instagram_url: input.instagramUrl ?? null,
      tiktok_url: input.tiktokUrl ?? null,
      youtube_url: input.youtubeUrl ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select("*")
    .single();

  if (configError) throw new Error(configError.message);
  const configId = String(configRow.id);

  const methodRows = enabledMethods.map((m, i) => {
    const handle = m.publicHandle ?? m.publicUrl ?? "";
    const validated = validatePaymentMethodInput(m.provider, handle);
    const normalized = validated.ok ? validated.normalized : handle;
    return {
      payment_page_config_id: configId,
      provider: m.provider,
      public_handle: m.provider === "zelle" ? normalized : normalized.replace(/^https?:\/\//, ""),
      public_url: m.publicUrl ?? (normalized.startsWith("http") ? normalized : null),
      instructions: m.instructions ?? null,
      uploaded_qr_image_url: m.uploadedQrImageUrl ?? null,
      enabled: true,
      sort_order: m.sortOrder ?? i,
    };
  });

  const { error: methodsError } = await supabase.from("payment_page_methods").insert(methodRows);
  if (methodsError) throw new Error(methodsError.message);

  if (input.suggestedAmounts?.length) {
    const amountRows = input.suggestedAmounts
      .filter((a) => a.enabled !== false)
      .map((a, i) => ({
        payment_page_config_id: configId,
        amount_cents: a.amountCents,
        label: a.label ?? null,
        enabled: true,
        sort_order: a.sortOrder ?? i,
      }));
    if (amountRows.length) {
      const { error: amountsError } = await supabase
        .from("payment_page_suggested_amounts")
        .insert(amountRows);
      if (amountsError) throw new Error(amountsError.message);
    }
  }

  const config = await getPaymentConfigByCampaignId(campaign.id);
  if (!config) throw new Error("Failed to load payment configuration.");
  return { campaign, config };
}

const DEDUP_WINDOW_MS = 3000;

export async function recordQrEvent(params: {
  campaignId: string;
  organizationId?: string | null;
  businessId?: string | null;
  eventType: QrEventType;
  provider?: PaymentProvider | null;
  amountSelectedCents?: number | null;
  sessionId?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
  isPreview?: boolean;
}): Promise<{ recorded: boolean }> {
  const supabase = createServiceClient();
  const { isBot, isPreview } = detectBotOrPreview(params.userAgent ?? undefined);
  const cats = categorizeUserAgent(params.userAgent ?? undefined);
  const ipHash = params.ip ? hashIpForQrScan(params.ip) : null;

  if (params.sessionId) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from("review_qr_events")
      .select("id")
      .eq("campaign_id", params.campaignId)
      .eq("event_type", params.eventType)
      .eq("session_id", params.sessionId)
      .gte("created_at", since)
      .maybeSingle();
    if (recent) return { recorded: false };
  }

  const { error } = await supabase.from("review_qr_events").insert({
    campaign_id: params.campaignId,
    organization_id: params.organizationId ?? null,
    business_id: params.businessId ?? null,
    event_type: params.eventType,
    provider: params.provider ?? null,
    amount_selected_cents: params.amountSelectedCents ?? null,
    session_id: params.sessionId ?? null,
    user_agent: params.userAgent?.slice(0, 512) ?? null,
    referrer: params.referrer?.slice(0, 512) ?? null,
    ip_hash: ipHash,
    device_category: cats.deviceCategory,
    is_bot: isBot,
    is_preview: params.isPreview ?? isPreview,
    metadata: params.metadata ?? {},
  });

  if (error) throw new Error(error.message);
  return { recorded: true };
}

export async function getPaymentQrAnalytics(
  campaignId: string,
  days = 30
): Promise<PaymentQrAnalytics> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from("review_qr_events")
    .select("*")
    .eq("campaign_id", campaignId)
    .gte("created_at", since)
    .eq("is_bot", false)
    .eq("is_preview", false)
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = events ?? [];
  const sessions = new Set<string>();
  const providerClicks: Record<string, number> = {};
  const amountSelections: Record<number, number> = {};
  let pageViews = 0;
  let paymentOptionClicks = 0;
  let externalPaymentReturns = 0;
  let reviewPromptViews = 0;
  let googleReviewClicks = 0;
  let facebookReviewClicks = 0;
  let qrDownloads = 0;
  let posterDownloads = 0;
  let verifiedStripePayments = 0;
  let verifiedStripeAmountCents = 0;

  for (const row of rows) {
    const eventType = String(row.event_type);
    if (row.session_id) sessions.add(String(row.session_id));

    switch (eventType) {
      case "page_view":
        pageViews++;
        break;
      case "payment_option_clicked":
        paymentOptionClicks++;
        const prov = row.provider ? String(row.provider) : "unknown";
        providerClicks[prov] = (providerClicks[prov] ?? 0) + 1;
        if (row.amount_selected_cents) {
          const cents = Number(row.amount_selected_cents);
          amountSelections[cents] = (amountSelections[cents] ?? 0) + 1;
        }
        break;
      case "external_payment_returned":
        externalPaymentReturns++;
        break;
      case "review_prompt_viewed":
        reviewPromptViews++;
        break;
      case "google_review_clicked":
        googleReviewClicks++;
        break;
      case "facebook_review_clicked":
        facebookReviewClicks++;
        break;
      case "qr_downloaded":
        qrDownloads++;
        break;
      case "poster_downloaded":
        posterDownloads++;
        break;
      case "stripe_payment_completed":
        verifiedStripePayments++;
        verifiedStripeAmountCents += Number(row.amount_selected_cents ?? 0);
        break;
    }
  }

  const { data: campaignRow } = await supabase
    .from("review_qr_campaigns")
    .select("total_scans")
    .eq("id", campaignId)
    .maybeSingle();
  const qrScans = Number(campaignRow?.total_scans ?? 0);

  const safeRate = (a: number, b: number): number | null =>
    b > 0 ? a / b : null;

  return {
    pageViews,
    uniqueVisitors: sessions.size,
    qrScans,
    paymentOptionClicks,
    providerClicks,
    amountSelections,
    externalPaymentReturns,
    reviewPromptViews,
    googleReviewClicks,
    facebookReviewClicks,
    qrDownloads,
    posterDownloads,
    verifiedStripePayments,
    verifiedStripeAmountCents,
    conversionRates: {
      scanToPageView: safeRate(pageViews, qrScans),
      pageViewToPaymentClick: safeRate(paymentOptionClicks, pageViews),
      paymentClickToReturn: safeRate(externalPaymentReturns, paymentOptionClicks),
      returnToReviewClick: safeRate(googleReviewClicks + facebookReviewClicks, externalPaymentReturns),
      pageViewToReviewClick: safeRate(googleReviewClicks + facebookReviewClicks, pageViews),
    },
    recentActivity: rows.slice(0, 50).map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      provider: row.provider ? String(row.provider) : null,
      amountSelectedCents: row.amount_selected_cents ? Number(row.amount_selected_cents) : null,
      createdAt: String(row.created_at),
      deviceCategory: row.device_category ? String(row.device_category) : null,
    })),
  };
}
