"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Copy,
  Check,
  CreditCard,
  Mail,
  Phone,
  Star,
} from "lucide-react";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import {
  PAYMENT_PURPOSE_HEADINGS,
  PROVIDER_CLICK_EVENTS,
  type AmountMode,
  type PaymentPageConfiguration,
  type PaymentProvider,
  type PaymentRequestSession,
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

function ProviderIcon({ provider }: { provider: PaymentProvider }) {
  const def = getPaymentProvider(provider);
  if (provider === "stripe") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#635BFF] text-white">
        <CreditCard className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
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
}: {
  slug: string;
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
  businessName: string;
  isPreview?: boolean;
  requestSession?: PaymentRequestSession | null;
}) {
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [zelleExpanded, setZelleExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
        .filter(
          (m) =>
            m.enabled &&
            (m.publicHandle?.trim() || m.publicUrl?.trim())
        )
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

      const json = (await res.json()) as {
        destinationUrl?: string | null;
        manualFlow?: boolean;
      };

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

  const primary = config.primaryColor ?? campaign.brandColor ?? "#2563EB";
  const zelleMethod = enabledMethods.find((m) => m.provider === "zelle");
  const zelleRecipient = zelleMethod?.publicHandle ?? "";

  const showReviews =
    Boolean(config.googleReviewUrl) || Boolean(config.facebookReviewUrl);

  const socialLinks = [
    config.facebookPageUrl && { type: "facebook", label: "Facebook", url: config.facebookPageUrl },
    config.instagramUrl && { type: "instagram", label: "Instagram", url: config.instagramUrl },
    config.pinterestUrl && { type: "pinterest", label: "Pinterest", url: config.pinterestUrl },
    config.tiktokUrl && { type: "tiktok", label: "TikTok", url: config.tiktokUrl },
    config.youtubeUrl && { type: "youtube", label: "YouTube", url: config.youtubeUrl },
    config.websiteUrl && { type: "website", label: "Website", url: config.websiteUrl },
    config.bookingUrl && { type: "booking", label: "Book", url: config.bookingUrl },
  ].filter(Boolean) as Array<{ type: string; label: string; url: string }>;

  return (
    <main className="min-h-screen bg-[#F4F7FB]">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
          {config.bannerUrl ? (
            <div className="relative h-28 w-full">
              <Image
                src={config.bannerUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div
              className="h-20 w-full"
              style={{
                background: `linear-gradient(135deg, ${primary} 0%, ${primary}88 100%)`,
              }}
            />
          )}

          <div className="px-6 pb-8 pt-6 text-center">
            {config.logoUrl ? (
              <div className="mx-auto -mt-12 mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
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
                className="mx-auto -mt-10 mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-xl font-bold text-white shadow-md"
                style={{ background: primary }}
              >
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}

            <h1 className="text-2xl font-extrabold tracking-tight text-[#0B1B32]">
              {businessName}
            </h1>
            {config.description ? (
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{config.description}</p>
            ) : null}
            <p className="mt-3 text-sm font-semibold text-[#334155]">{heading}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Pay securely using your preferred method.
            </p>

            {lockedAmountCents ? (
              <div className="mt-6 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">
                  Amount
                </p>
                <p className="mt-1 text-3xl font-extrabold text-[#0B1B32]">
                  {formatMoney(lockedAmountCents)}
                </p>
                {lockedNote ? (
                  <p className="mt-2 text-sm text-[#64748B]">{lockedNote}</p>
                ) : null}
              </div>
            ) : null}

            {amountMode === "suggested" && !lockedAmountCents && enabledAmounts.length > 0 && (
              <div className="mt-6">
                <p className="text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Select an amount
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {enabledAmounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAmountCents(a.amountCents);
                        setCustomAmount("");
                        if (!isPreview) {
                          void trackEvent(slug, "amount_selected", {
                            amountSelectedCents: a.amountCents,
                          });
                        }
                      }}
                      className={cn(
                        "rounded-full border-2 py-2.5 text-sm font-bold transition",
                        selectedAmountCents === a.amountCents
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                          : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#CBD5E1]"
                      )}
                    >
                      ${(a.amountCents / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
                {config.allowCustomAmount && (
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter custom amount"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmountCents(null);
                    }}
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
                    className="mt-3 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-center text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                )}
              </div>
            )}

            {amountMode === "custom" && !lockedAmountCents && (
              <div className="mt-6">
                <p className="text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Enter payment amount
                </p>
                <div className="mt-2 flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <span className="text-lg font-bold text-[#64748B]">$</span>
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
                    className="ml-2 w-full bg-transparent text-lg font-semibold text-[#0B1B32] outline-none"
                  />
                </div>
              </div>
            )}

            {enabledMethods.length > 0 && (
              <div className="mt-8">
                <p className="text-left text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Payment methods
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
                            "flex w-full items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-left transition hover:border-[#CBD5E1] hover:shadow-sm",
                            blocked && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <ProviderIcon provider={method.provider} />
                          <span className="flex-1 text-sm font-semibold text-[#0B1B32]">
                            {def.buttonLabel}
                          </span>
                          <ChevronRight className="h-5 w-5 text-[#94A3B8]" />
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
              <div className="mt-4 rounded-2xl border border-[#E9D5FF] bg-[#F5F3FF] p-4 text-sm">
                <p className="font-bold text-[#0B1B32]">Pay with Zelle</p>
                <p className="mt-1 text-xs text-[#64748B]">Send payment to:</p>
                <p className="mt-2 font-semibold text-[#0B1B32]">{zelleRecipient}</p>
                {effectiveAmountCents ? (
                  <p className="mt-3 text-xs text-[#64748B]">
                    Selected amount:{" "}
                    <span className="font-semibold text-[#0B1B32]">
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
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold"
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold"
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
                  className="mt-3 text-xs font-semibold text-[#64748B] hover:text-[#334155]"
                >
                  Back to payment methods
                </button>
              </div>
            )}

            {showReviews && (
              <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] p-5">
                <div className="flex items-center justify-center gap-1 text-[#F59E0B]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-2 text-center text-sm font-bold text-[#0B1B32]">
                  Enjoyed your experience?
                </p>
                <p className="mt-1 text-center text-xs text-[#64748B]">
                  Your feedback helps our local business grow.
                </p>
                {config.googleReviewUrl && (
                  <button
                    type="button"
                    onClick={() => void handleReviewClick("google", config.googleReviewUrl!)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4285F4] py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
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
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                  >
                    Leave a Facebook Review
                  </button>
                )}
              </div>
            )}

            {(socialLinks.length > 0 || config.phone || config.email) && (
              <div className="mt-8">
                <p className="text-center text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Connect with us
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
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
                      className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:border-[#CBD5E1]"
                    >
                      {link.label}
                    </button>
                  ))}
                  {config.phone && (
                    <a
                      href={`tel:${config.phone}`}
                      onClick={() => !isPreview && void trackEvent(slug, "social_link_clicked", { metadata: { linkType: "phone" } })}
                      className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155]"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                  {config.email && (
                    <a
                      href={`mailto:${config.email}`}
                      onClick={() => !isPreview && void trackEvent(slug, "social_link_clicked", { metadata: { linkType: "email" } })}
                      className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155]"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-[10px] leading-relaxed text-[#94A3B8]">
              Payments are completed directly through the selected provider. Local SEO Express
              does not process, hold, or verify funds sent through external payment apps.
            </p>

            {config.showPlatformBranding && (
              <p className="mt-3 text-center text-[10px] text-[#CBD5E1]">
                Powered by Local SEO Express
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
