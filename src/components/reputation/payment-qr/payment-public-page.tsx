"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Copy,
  Check,
  CreditCard,
  Mail,
  Menu,
  Phone,
  Star,
} from "lucide-react";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import { getPageTheme } from "@/lib/reputation/payment-qr/page-themes";
import {
  PaymentPageFooterWave,
  PaymentPageHeaderDecor,
} from "@/components/reputation/payment-qr/payment-page-header-decor";
import {
  PAYMENT_PURPOSE_HEADINGS,
  PROVIDER_CLICK_EVENTS,
  type AmountMode,
  type PaymentPageConfiguration,
  type PaymentProvider,
  type PaymentRequestSession,
  type PageThemeKey,
} from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "lse_pay_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

async function trackEvent(
  slug: string,
  eventType: string,
  extra?: {
    provider?: PaymentProvider;
    amountSelectedCents?: number;
    metadata?: Record<string, string>;
  }
) {
  try {
    await fetch("/api/public/payment-qr/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        eventType,
        sessionId: sessionId(),
        provider: extra?.provider,
        amountSelectedCents: extra?.amountSelectedCents,
        metadata: extra?.metadata,
      }),
    });
  } catch {
    // non-blocking
  }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatAmountLabel(amountCents: number, label: string | null): string {
  if (label?.trim()) return label.trim();
  return `$${(amountCents / 100).toFixed(0)}`;
}

function ProviderIcon({ provider }: { provider: PaymentProvider }) {
  const def = getPaymentProvider(provider);
  if (provider === "stripe") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#635BFF] text-white">
        <CreditCard className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ background: def.brandColor }}
    >
      {def.displayName.charAt(0)}
    </span>
  );
}

export function PaymentPublicPage({
  slug,
  campaign,
  config,
  businessName,
  isPreview = false,
  requestSession = null,
  themeOverride,
}: {
  slug: string;
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
  businessName: string;
  isPreview?: boolean;
  requestSession?: PaymentRequestSession | null;
  /** Dev preview: force a specific visual template */
  themeOverride?: PageThemeKey;
}) {
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [zelleExpanded, setZelleExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const theme = getPageTheme(themeOverride ?? config.pageTheme);
  const amountMode: AmountMode = requestSession ? "suggested" : config.amountMode;
  const lockedAmountCents = requestSession?.amountCents ?? null;
  const lockedNote = requestSession?.note ?? config.paymentNote ?? null;

  const heading =
    config.title ??
    (config.purpose === "custom" && config.customPurposeLabel
      ? config.customPurposeLabel
      : PAYMENT_PURPOSE_HEADINGS[config.purpose]);

  const enabledMethods = useMemo(
    () =>
      config.methods
        .filter((m) => m.enabled && (m.publicHandle?.trim() || m.publicUrl?.trim()))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config.methods]
  );

  const enabledAmounts = useMemo(
    () =>
      config.suggestedAmounts
        .filter((a) => a.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config.suggestedAmounts]
  );

  const effectiveAmountCents = useMemo(() => {
    if (lockedAmountCents) return lockedAmountCents;
    if (amountMode === "none") return null;
    if (selectedAmountCents) return selectedAmountCents;
    if (customAmount) {
      const parsed = parseFloat(customAmount);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed * 100);
    }
    return null;
  }, [lockedAmountCents, amountMode, selectedAmountCents, customAmount]);

  const requiresAmount = amountMode !== "none" && !lockedAmountCents;

  useEffect(() => {
    if (isPreview) return;
    void trackEvent(slug, "page_view");
    const fromQr = document.referrer.includes("/r/") || document.referrer.includes("/go/");
    if (fromQr) void trackEvent(slug, "qr_scan");
  }, [slug, isPreview]);

  const copyText = async (field: string, text: string, eventType?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      if (!isPreview && eventType) void trackEvent(slug, eventType);
    } catch {
      // ignore
    }
  };

  const handlePaymentClick = useCallback(
    async (provider: PaymentProvider) => {
      const amount = effectiveAmountCents;
      if (requiresAmount && (!amount || amount <= 0)) return;

      if (provider === "zelle") {
        setZelleExpanded(true);
        if (!isPreview) {
          void trackEvent(slug, PROVIDER_CLICK_EVENTS.zelle, {
            provider,
            amountSelectedCents: amount ?? undefined,
          });
        }
        return;
      }

      if (isPreview) return;

      const res = await fetch("/api/public/payment-qr/open-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          provider,
          amountCents: amount,
          note: lockedNote,
          sessionId: sessionId(),
        }),
      });

      const json = (await res.json()) as { destinationUrl?: string | null };
      if (!res.ok) return;
      if (json.destinationUrl) {
        window.open(json.destinationUrl, "_blank", "noopener,noreferrer");
      }
    },
    [slug, effectiveAmountCents, lockedNote, requiresAmount, isPreview]
  );

  const handleReviewClick = async (type: "google" | "facebook", url: string) => {
    if (!isPreview) {
      await trackEvent(
        slug,
        type === "google" ? "google_review_clicked" : "facebook_review_clicked"
      );
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSocialClick = async (
    eventType: "website_clicked" | "booking_link_clicked" | "social_link_clicked",
    url: string,
    linkType: string
  ) => {
    if (!isPreview) {
      await trackEvent(slug, eventType, { metadata: { linkType } });
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const zelleMethod = enabledMethods.find((m) => m.provider === "zelle");
  const zelleRecipient = zelleMethod?.publicHandle ?? "";
  const showReviews =
    Boolean(config.googleReviewUrl) || Boolean(config.facebookReviewUrl);

  const socialLinks = [
    config.facebookPageUrl && { type: "facebook", label: "f", url: config.facebookPageUrl },
    config.instagramUrl && { type: "instagram", label: "IG", url: config.instagramUrl },
    config.pinterestUrl && { type: "pinterest", label: "P", url: config.pinterestUrl },
    config.tiktokUrl && { type: "tiktok", label: "TT", url: config.tiktokUrl },
    config.youtubeUrl && { type: "youtube", label: "YT", url: config.youtubeUrl },
    config.websiteUrl && { type: "website", label: "W", url: config.websiteUrl },
    config.bookingUrl && { type: "booking", label: "B", url: config.bookingUrl },
  ].filter(Boolean) as Array<{ type: string; label: string; url: string }>;

  const reviewPrompt =
    theme.key === "bold_professional"
      ? "Loved our service? Leave us a review below!"
      : "Enjoyed your experience?";

  const reviewSubtext =
    theme.key === "bold_professional"
      ? "Your feedback helps us grow."
      : "Your feedback helps our local business grow.";

  return (
    <main className="min-h-screen" style={{ background: theme.pageBg }}>
      <div className="mx-auto max-w-md px-3 py-4 sm:px-4 sm:py-6">
        <div
          className="overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/5"
          style={{ background: theme.cardBg }}
        >
          <div className="relative">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-2 opacity-60"
              style={{ color: theme.isDark ? theme.textPrimary : "#64748B" }}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {config.bannerUrl ? (
              <div className="relative h-28 w-full">
                <Image src={config.bannerUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : (
              <PaymentPageHeaderDecor theme={theme} />
            )}
          </div>

          <div className="px-5 pb-8 pt-4 text-center sm:px-6">
            {config.logoUrl ? (
              <div
                className="mx-auto -mt-10 mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 shadow-md"
                style={{ borderColor: theme.cardBg, background: theme.cardBg }}
              >
                <Image
                  src={config.logoUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="mx-auto -mt-8 mb-3 flex h-16 w-16 items-center justify-center rounded-full border-4 text-xl font-bold text-white shadow-md"
                style={{
                  borderColor: theme.cardBg,
                  background: theme.primary,
                }}
              >
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}

            <h1
              className={cn(
                "text-2xl font-extrabold tracking-tight",
                theme.serifHeading && "font-serif"
              )}
              style={{ color: theme.textPrimary }}
            >
              {businessName}
            </h1>
            {config.description ? (
              <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>
                {config.description}
              </p>
            ) : null}
            <p className="mt-2 text-sm font-semibold" style={{ color: theme.textSecondary }}>
              {heading}
            </p>

            {lockedAmountCents ? (
              <div
                className="mt-5 rounded-2xl border px-4 py-4"
                style={{
                  borderColor: theme.pillBorder,
                  background: theme.pillBg,
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: theme.sectionLabel }}
                >
                  Amount
                </p>
                <p className="mt-1 text-3xl font-extrabold" style={{ color: theme.textPrimary }}>
                  {formatMoney(lockedAmountCents)}
                </p>
                {lockedNote ? (
                  <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>{lockedNote}</p>
                ) : null}
              </div>
            ) : null}

            {amountMode === "suggested" && !lockedAmountCents && enabledAmounts.length > 0 && (
              <div className="mt-6 text-left">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: theme.sectionLabel }}
                >
                  Select amount
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {enabledAmounts.map((a) => {
                    const selected = selectedAmountCents === a.amountCents && !showCustomInput;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setSelectedAmountCents(a.amountCents);
                          setCustomAmount("");
                          setShowCustomInput(false);
                          if (!isPreview) {
                            void trackEvent(slug, "amount_selected", {
                              amountSelectedCents: a.amountCents,
                            });
                          }
                        }}
                        className="rounded-full border-2 px-4 py-2.5 text-sm font-bold transition"
                        style={{
                          background: selected ? theme.pillSelectedBg : theme.pillBg,
                          borderColor: selected ? theme.pillSelectedBorder : theme.pillBorder,
                          color: selected ? theme.pillSelectedText : theme.textSecondary,
                        }}
                      >
                        {formatAmountLabel(a.amountCents, a.label)}
                      </button>
                    );
                  })}
                  {config.allowCustomAmount && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomInput(true);
                        setSelectedAmountCents(null);
                      }}
                      className="rounded-full border-2 px-4 py-2.5 text-sm font-bold transition"
                      style={{
                        background: showCustomInput ? theme.pillSelectedBg : theme.pillBg,
                        borderColor: showCustomInput ? theme.pillSelectedBorder : theme.pillBorder,
                        color: showCustomInput ? theme.pillSelectedText : theme.textSecondary,
                      }}
                    >
                      Custom
                    </button>
                  )}
                </div>
                {(showCustomInput || config.allowCustomAmount) && showCustomInput && (
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter custom amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onBlur={() => {
                      if (!isPreview && customAmount) {
                        const parsed = parseFloat(customAmount);
                        if (!Number.isNaN(parsed) && parsed > 0) {
                          void trackEvent(slug, "custom_amount_entered", {
                            amountSelectedCents: Math.round(parsed * 100),
                          });
                        }
                      }
                    }}
                    className="mt-3 w-full rounded-xl border px-4 py-3 text-center text-sm outline-none"
                    style={{
                      borderColor: theme.pillBorder,
                      background: theme.pillBg,
                      color: theme.textPrimary,
                    }}
                  />
                )}
              </div>
            )}

            {amountMode === "custom" && !lockedAmountCents && (
              <div className="mt-6 text-left">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: theme.sectionLabel }}
                >
                  Enter payment amount
                </p>
                <div
                  className="mt-2 flex items-center rounded-xl border px-4 py-3"
                  style={{ borderColor: theme.pillBorder, background: theme.pillBg }}
                >
                  <span className="text-lg font-bold" style={{ color: theme.textMuted }}>$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onBlur={() => {
                      if (!isPreview && customAmount) {
                        const parsed = parseFloat(customAmount);
                        if (!Number.isNaN(parsed) && parsed > 0) {
                          void trackEvent(slug, "custom_amount_entered", {
                            amountSelectedCents: Math.round(parsed * 100),
                          });
                        }
                      }
                    }}
                    className="ml-2 w-full bg-transparent text-lg font-semibold outline-none"
                    style={{ color: theme.textPrimary }}
                  />
                </div>
              </div>
            )}

            {enabledMethods.length > 0 && (
              <div className="mt-8 text-left">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: theme.sectionLabel }}
                >
                  Pay via
                </p>
                <div className="mt-3 space-y-2">
                  {enabledMethods
                    .filter((m) => m.provider !== "zelle" || !zelleExpanded)
                    .map((method) => {
                      const def = getPaymentProvider(method.provider);
                      const blocked =
                        requiresAmount && (!effectiveAmountCents || effectiveAmountCents <= 0);
                      return (
                        <button
                          key={method.id}
                          type="button"
                          disabled={blocked}
                          onClick={() => void handlePaymentClick(method.provider)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:shadow-sm",
                            blocked && "cursor-not-allowed opacity-50"
                          )}
                          style={{
                            background: theme.methodCardBg,
                            borderColor: theme.methodCardBorder,
                          }}
                        >
                          <ProviderIcon provider={method.provider} />
                          <span
                            className="flex-1 text-sm font-semibold"
                            style={{ color: theme.textPrimary }}
                          >
                            {def.buttonLabel}
                          </span>
                          <ChevronRight className="h-5 w-5" style={{ color: theme.textMuted }} />
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {requiresAmount && !effectiveAmountCents && enabledMethods.length > 0 && (
              <p className="mt-3 text-center text-xs text-[#B45309]">
                Select or enter an amount before choosing a payment method.
              </p>
            )}

            {zelleExpanded && zelleRecipient && (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm"
                style={{
                  borderColor: theme.methodCardBorder,
                  background: theme.methodCardBg,
                }}
              >
                <p className="font-bold" style={{ color: theme.textPrimary }}>Pay with Zelle</p>
                <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Send payment to:</p>
                <p className="mt-2 font-semibold" style={{ color: theme.textPrimary }}>
                  {zelleRecipient}
                </p>
                {effectiveAmountCents ? (
                  <p className="mt-3 text-xs" style={{ color: theme.textMuted }}>
                    Selected amount:{" "}
                    <span className="font-semibold" style={{ color: theme.textPrimary }}>
                      {formatMoney(effectiveAmountCents)}
                    </span>
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void copyText("zelle-email", zelleRecipient, "zelle_email_copied")
                    }
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{
                      borderColor: theme.methodCardBorder,
                      background: theme.cardBg,
                      color: theme.textPrimary,
                    }}
                  >
                    {copiedField === "zelle-email" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy email/phone
                  </button>
                  {effectiveAmountCents ? (
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(
                          "zelle-amount",
                          formatMoney(effectiveAmountCents),
                          "zelle_amount_copied"
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"
                      style={{
                        borderColor: theme.methodCardBorder,
                        background: theme.cardBg,
                        color: theme.textPrimary,
                      }}
                    >
                      {copiedField === "zelle-amount" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy amount
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setZelleExpanded(false)}
                  className="mt-3 text-xs font-semibold"
                  style={{ color: theme.textMuted }}
                >
                  Back to payment methods
                </button>
              </div>
            )}

            {showReviews && (
              <div
                className="mt-8 rounded-2xl border p-5"
                style={{
                  background: theme.reviewBoxBg,
                  borderColor: theme.reviewBoxBorder,
                }}
              >
                <div className="flex items-center justify-center gap-1 text-[#F59E0B]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p
                  className="mt-2 text-center text-sm font-bold"
                  style={{ color: theme.isDark ? theme.textPrimary : theme.textPrimary }}
                >
                  {reviewPrompt}
                </p>
                <p className="mt-1 text-center text-xs" style={{ color: theme.textMuted }}>
                  {reviewSubtext}
                </p>
                {config.googleReviewUrl && (
                  <button
                    type="button"
                    onClick={() => void handleReviewClick("google", config.googleReviewUrl!)}
                    className="mt-4 flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                    style={{ background: theme.googleReviewBg }}
                  >
                    Leave a Google Review
                  </button>
                )}
                {config.facebookReviewUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleReviewClick("facebook", config.facebookReviewUrl!)
                    }
                    className="mt-2 flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                    style={{
                      background: theme.facebookReviewBg,
                      color: theme.key === "bold_professional" ? theme.primary : "#fff",
                    }}
                  >
                    Leave a Facebook Review
                  </button>
                )}
              </div>
            )}

            {(socialLinks.length > 0 || config.phone || config.email) && (
              <div className="mt-8">
                <p
                  className="text-center text-xs font-bold uppercase tracking-wide"
                  style={{ color: theme.sectionLabel }}
                >
                  Follow us
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-3">
                  {socialLinks.map((link) => (
                    <button
                      key={link.type}
                      type="button"
                      onClick={() =>
                        void handleSocialClick(
                          link.type === "website"
                            ? "website_clicked"
                            : link.type === "booking"
                              ? "booking_link_clicked"
                              : "social_link_clicked",
                          link.url,
                          link.type
                        )
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full border text-xs font-bold transition hover:opacity-90"
                      style={{
                        background: theme.socialPillBg,
                        borderColor: theme.socialPillBorder,
                        color: theme.socialPillText,
                      }}
                      title={link.type}
                    >
                      {link.label}
                    </button>
                  ))}
                  {config.phone && (
                    <a
                      href={`tel:${config.phone}`}
                      onClick={() =>
                        !isPreview &&
                        void trackEvent(slug, "social_link_clicked", { metadata: { linkType: "phone" } })
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full border"
                      style={{
                        background: theme.socialPillBg,
                        borderColor: theme.socialPillBorder,
                        color: theme.socialPillText,
                      }}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  {config.email && (
                    <a
                      href={`mailto:${config.email}`}
                      onClick={() =>
                        !isPreview &&
                        void trackEvent(slug, "social_link_clicked", { metadata: { linkType: "email" } })
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-full border"
                      style={{
                        background: theme.socialPillBg,
                        borderColor: theme.socialPillBorder,
                        color: theme.socialPillText,
                      }}
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <p
              className="mt-8 text-center text-[10px] leading-relaxed"
              style={{ color: theme.disclaimer }}
            >
              Payments are completed directly through the selected provider. Local SEO Express
              does not process, hold, or verify funds sent through external payment apps.
            </p>

            {config.showPlatformBranding && (
              <p className="mt-3 text-center text-[10px]" style={{ color: theme.disclaimer }}>
                Powered by Local SEO Express
              </p>
            )}
          </div>

          <PaymentPageFooterWave theme={theme} />
        </div>
      </div>
    </main>
  );
}
