"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  buildPaymentDestination,
  getPaymentProvider,
} from "@/lib/reputation/payment-qr/providers";
import {
  PAYMENT_PURPOSE_HEADINGS,
  type PaymentPageConfiguration,
  type PaymentProvider,
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
      }),
    });
  } catch {
    // non-blocking
  }
}

type Step = "pay" | "return" | "review";

export function PaymentPublicPage({
  slug,
  campaign,
  config,
  businessName,
  isPreview = false,
}: {
  slug: string;
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
  businessName: string;
  isPreview?: boolean;
}) {
  const [step, setStep] = useState<Step>("pay");
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [copiedZelle, setCopiedZelle] = useState(false);

  const heading =
    config.title ??
    (config.purpose === "custom" && config.customPurposeLabel
      ? config.customPurposeLabel
      : PAYMENT_PURPOSE_HEADINGS[config.purpose]);

  const enabledMethods = useMemo(
    () => config.methods.filter((m) => m.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
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
    if (selectedAmountCents) return selectedAmountCents;
    if (customAmount) {
      const parsed = parseFloat(customAmount);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed * 100);
    }
    return null;
  }, [selectedAmountCents, customAmount]);

  useEffect(() => {
    if (isPreview) return;
    void trackEvent(slug, "page_view");
    const fromQr = document.referrer.includes("/r/") || document.referrer.includes("/go/");
    if (fromQr) void trackEvent(slug, "qr_scan");
  }, [slug, isPreview]);

  const handlePaymentClick = useCallback(
    async (provider: PaymentProvider, handle: string) => {
      await trackEvent(slug, "payment_option_clicked", {
        provider,
        amountSelectedCents: effectiveAmountCents ?? undefined,
      });

      const url = buildPaymentDestination(provider, handle, effectiveAmountCents ?? undefined);
      if (provider === "zelle") {
        setStep("return");
        return;
      }
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      setStep("return");
    },
    [slug, effectiveAmountCents]
  );

  const handleContinue = async () => {
    await trackEvent(slug, "external_payment_returned");
    if (config.showReviewPrompt) {
      await trackEvent(slug, "review_prompt_viewed");
      setStep("review");
    }
  };

  const handleReviewClick = async (type: "google" | "facebook", url: string) => {
    await trackEvent(
      slug,
      type === "google" ? "google_review_clicked" : "facebook_review_clicked"
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const primary = config.primaryColor ?? campaign.brandColor ?? "#2563EB";

  return (
    <main
      className="min-h-screen"
      style={{
        background: `linear-gradient(160deg, ${primary} 0%, #1e1b4b 55%, #0f172a 100%)`,
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-8">
        {step === "pay" && (
          <div className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="px-6 pt-8 pb-6 text-center">
              {config.logoUrl ? (
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                  <Image
                    src={config.logoUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
                  style={{ background: primary }}
                >
                  {businessName.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 className="text-2xl font-extrabold text-[#0B1B32]">{businessName}</h1>
              <p className="mt-1 text-lg font-semibold text-[#334155]">{heading}</p>
              {config.description ? (
                <p className="mt-2 text-sm text-[#64748B]">{config.description}</p>
              ) : null}
            </div>

            {enabledAmounts.length > 0 && (
              <div className="px-6 pb-4">
                <div className="grid grid-cols-4 gap-2">
                  {enabledAmounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAmountCents(a.amountCents);
                        setCustomAmount("");
                      }}
                      className={cn(
                        "rounded-xl border-2 py-3 text-sm font-bold transition",
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
                    min="1"
                    step="0.01"
                    placeholder="Other amount"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmountCents(null);
                    }}
                    className="mt-3 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-center text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                )}
              </div>
            )}

            <div className="space-y-3 px-6 pb-6">
              {enabledMethods.map((method) => {
                const def = getPaymentProvider(method.provider);
                const handle = method.publicHandle ?? method.publicUrl ?? "";
                if (method.provider === "zelle") {
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        void handlePaymentClick("zelle", handle);
                        navigator.clipboard?.writeText(handle).catch(() => undefined);
                        setCopiedZelle(true);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white shadow-md transition hover:opacity-95"
                      style={{ background: def.brandColor }}
                    >
                      Pay with Zelle
                    </button>
                  );
                }
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => void handlePaymentClick(method.provider, handle)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white shadow-md transition hover:opacity-95"
                    style={{ background: def.brandColor }}
                  >
                    Pay with {def.displayName}
                  </button>
                );
              })}
            </div>

            <p className="px-6 pb-6 text-center text-xs text-[#94A3B8]">
              Payments are completed directly through the selected payment provider. Local SEO
              Express does not process, hold, or verify funds sent through external payment apps.
            </p>

            {config.showPlatformBranding && (
              <div className="border-t border-[#F1F5F9] px-6 py-3 text-center text-xs text-[#94A3B8]">
                Powered by Local SEO Express
              </div>
            )}
          </div>
        )}

        {step === "return" && (
          <div className="w-full overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl">
            <h2 className="text-xl font-extrabold text-[#0B1B32]">
              {copiedZelle ? "Zelle info copied" : "Finished paying?"}
            </h2>
            {copiedZelle && (
              <p className="mt-2 text-sm text-[#64748B]">
                Send via Zelle to:{" "}
                <strong>
                  {enabledMethods.find((m) => m.provider === "zelle")?.publicHandle}
                </strong>
              </p>
            )}
            <p className="mt-3 text-sm text-[#64748B]">
              When you&apos;re done in your payment app, tap Continue.
            </p>
            <button
              type="button"
              onClick={() => void handleContinue()}
              className="mt-6 w-full rounded-xl py-4 text-base font-bold text-white shadow-md"
              style={{ background: primary }}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep("pay")}
              className="mt-3 text-sm text-[#64748B] hover:text-[#334155]"
            >
              Back to payment options
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="w-full overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl">
            <h2 className="text-xl font-extrabold text-[#0B1B32]">
              {config.thankYouMessage ?? "Thank you for your support!"}
            </h2>
            <p className="mt-3 text-sm text-[#64748B]">
              Share your experience on Google.
            </p>
            {config.googleReviewUrl && (
              <button
                type="button"
                onClick={() => void handleReviewClick("google", config.googleReviewUrl!)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#4285F4] py-4 text-base font-bold text-white shadow-md"
              >
                <span className="text-lg font-black">G</span>
                Share your experience on Google
              </button>
            )}
            {config.facebookReviewUrl && (
              <button
                type="button"
                onClick={() => void handleReviewClick("facebook", config.facebookReviewUrl!)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] py-4 text-base font-bold text-white shadow-md"
              >
                Share on Facebook
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep("pay")}
              className="mt-4 text-sm text-[#94A3B8] hover:text-[#64748B]"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
