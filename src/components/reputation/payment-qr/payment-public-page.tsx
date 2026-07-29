"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Copy, Check } from "lucide-react";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import {
  PAYMENT_PURPOSE_HEADINGS,
  type PaymentMode,
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
    paymentRequestSessionId?: string;
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
        paymentRequestSessionId: extra?.paymentRequestSessionId,
      }),
    });
  } catch {
    // non-blocking
  }
}

type Step = "pay" | "return" | "review";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentPublicPage({
  slug,
  campaign,
  config,
  businessName,
  isPreview = false,
  previewStep,
  requestSession = null,
  paymentMode = "reusable_page",
}: {
  slug: string;
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
  businessName: string;
  isPreview?: boolean;
  previewStep?: Step;
  requestSession?: PaymentRequestSession | null;
  paymentMode?: PaymentMode;
}) {
  const [step, setStep] = useState<Step>(previewStep ?? "pay");
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(
    requestSession?.amountCents ?? null
  );
  const [customAmount, setCustomAmount] = useState("");
  const [zelleExpanded, setZelleExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const leftForProviderRef = useRef(false);

  const isLockedRequest = Boolean(requestSession);
  const lockedNote = requestSession?.note ?? null;

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
    if (requestSession?.amountCents) return requestSession.amountCents;
    if (selectedAmountCents) return selectedAmountCents;
    if (customAmount) {
      const parsed = parseFloat(customAmount);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed * 100);
    }
    return null;
  }, [requestSession, selectedAmountCents, customAmount]);

  useEffect(() => {
    if (previewStep) setStep(previewStep);
  }, [previewStep]);

  useEffect(() => {
    if (isPreview) return;
    void trackEvent(slug, "page_view", {
      paymentRequestSessionId: requestSession?.id,
    });
    const fromQr = document.referrer.includes("/r/") || document.referrer.includes("/go/");
    if (fromQr) void trackEvent(slug, "qr_scan", { paymentRequestSessionId: requestSession?.id });
  }, [slug, isPreview, requestSession?.id]);

  // Detect customer returning from external payment app
  useEffect(() => {
    if (isPreview) return;

    const onReturn = () => {
      if (!leftForProviderRef.current || !awaitingReturn) return;
      setStep("return");
      setAwaitingReturn(false);
      leftForProviderRef.current = false;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onReturn();
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onReturn();
    };

    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [isPreview, awaitingReturn]);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const handlePaymentClick = useCallback(
    async (provider: PaymentProvider) => {
      const amount = effectiveAmountCents;
      if (!amount || amount <= 0) {
        return;
      }

      if (provider === "zelle") {
        setZelleExpanded(true);
        await trackEvent(slug, "payment_option_clicked", {
          provider,
          amountSelectedCents: amount,
          paymentRequestSessionId: requestSession?.id,
        });
        return;
      }

      const res = await fetch("/api/public/payment-qr/open-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          provider,
          amountCents: amount,
          note: lockedNote,
          sessionId: sessionId(),
          isPreview,
        }),
      });

      const json = (await res.json()) as {
        destinationUrl?: string | null;
        manualFlow?: boolean;
        error?: string;
      };

      if (!res.ok) return;

      if (json.manualFlow) {
        setZelleExpanded(true);
        setStep("pay");
        return;
      }

      if (json.destinationUrl) {
        leftForProviderRef.current = true;
        setAwaitingReturn(true);
        window.open(json.destinationUrl, "_blank", "noopener,noreferrer");
      }
    },
    [slug, effectiveAmountCents, lockedNote, requestSession?.id, isPreview]
  );

  const handleContinue = async () => {
    await trackEvent(slug, "external_payment_returned", {
      paymentRequestSessionId: requestSession?.id,
    });
    if (config.showReviewPrompt) {
      await trackEvent(slug, "review_prompt_viewed", {
        paymentRequestSessionId: requestSession?.id,
      });
      setStep("review");
    }
  };

  const handleReviewClick = async (type: "google" | "facebook", url: string) => {
    await trackEvent(
      slug,
      type === "google" ? "google_review_clicked" : "facebook_review_clicked",
      { paymentRequestSessionId: requestSession?.id }
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const primary = config.primaryColor ?? campaign.brandColor ?? "#2563EB";
  const zelleMethod = enabledMethods.find((m) => m.provider === "zelle");
  const zelleRecipient = zelleMethod?.publicHandle ?? "";

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

            {isLockedRequest && effectiveAmountCents ? (
              <div className="px-6 pb-4">
                <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">
                    Amount due
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-[#0B1B32]">
                    {formatMoney(effectiveAmountCents)}
                  </p>
                  {lockedNote ? (
                    <p className="mt-2 text-sm text-[#64748B]">{lockedNote}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!isLockedRequest && enabledAmounts.length > 0 && (
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
                {config.allowCustomAmount && paymentMode === "reusable_page" && (
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Enter amount"
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

            {!isLockedRequest && config.allowCustomAmount && enabledAmounts.length === 0 && (
              <div className="px-6 pb-4">
                <label className="text-xs font-semibold text-[#64748B]">Amount</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-center text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            )}

            {zelleExpanded && zelleRecipient ? (
              <div className="px-6 pb-4">
                <div className="rounded-2xl border border-[#E9D5FF] bg-[#F5F3FF] p-4 text-sm">
                  <p className="font-bold text-[#0B1B32]">Pay with Zelle</p>
                  <p className="mt-2 text-[#64748B]">
                    Open your banking app, choose Zelle, and send manually:
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-[#64748B]">Send to</span>
                      <span className="font-semibold text-[#0B1B32]">{zelleRecipient}</span>
                    </div>
                    {effectiveAmountCents ? (
                      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                        <span className="text-[#64748B]">Amount</span>
                        <span className="font-semibold text-[#0B1B32]">
                          {formatMoney(effectiveAmountCents)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText("email", zelleRecipient)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold"
                    >
                      {copiedField === "email" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy email/phone
                    </button>
                    {effectiveAmountCents ? (
                      <button
                        type="button"
                        onClick={() => void copyText("amount", formatMoney(effectiveAmountCents!))}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold"
                      >
                        {copiedField === "amount" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy amount
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("return")}
                    className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white"
                    style={{ background: primary }}
                  >
                    I&apos;ve sent the Zelle payment
                  </button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 px-6 pb-6">
              {enabledMethods
                .filter((m) => !zelleExpanded || m.provider !== "zelle")
                .map((method) => {
                  const def = getPaymentProvider(method.provider);
                  const needsAmount = !effectiveAmountCents || effectiveAmountCents <= 0;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={needsAmount}
                      onClick={() => void handlePaymentClick(method.provider)}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white shadow-md transition hover:opacity-95",
                        needsAmount && "opacity-50 cursor-not-allowed"
                      )}
                      style={{ background: def.brandColor }}
                    >
                      Pay with {def.displayName}
                    </button>
                  );
                })}
            </div>

            {!effectiveAmountCents && (
              <p className="px-6 pb-4 text-center text-sm text-[#B45309]">
                Enter or select an amount before choosing a payment method.
              </p>
            )}

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
              Done sending your payment?
            </h2>
            <p className="mt-3 text-sm text-[#64748B]">
              When you&apos;re finished in your payment app, tap Continue. We do not verify that
              payment was completed.
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
              onClick={() => {
                setZelleExpanded(false);
                setStep("pay");
              }}
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
            <p className="mt-3 text-sm text-[#64748B]">Share your experience on Google.</p>
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
