"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Smartphone,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import { qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import {
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_PURPOSES,
  PAYMENT_PROVIDERS,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  type PaymentMode,
  type PaymentPurpose,
  type PaymentProvider,
} from "@/lib/reputation/payment-qr/types";
import type { PaymentPageConfiguration } from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  { id: 1, label: "Basic details" },
  { id: 2, label: "Payment methods" },
  { id: 3, label: "Customizing" },
  { id: 4, label: "Preview & publish" },
] as const;

const PURPOSE_ICONS: Record<PaymentPurpose, string> = {
  tip: "💵",
  pay: "💳",
  donate: "❤️",
  pay_invoice: "📄",
  leave_deposit: "🏦",
  support_us: "🙌",
  custom: "✏️",
};

type MethodState = {
  enabled: boolean;
  value: string;
};

export function PaymentQrCreateWizard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const base = `/businesses/${businessId}/reputation/qr-campaigns`;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [businessName, setBusinessName] = useState("Your business");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [entitlements, setEntitlements] = useState({
    reviewLinks: false,
    customSlug: false,
    suggestedAmounts: false,
    customBranding: false,
  });

  const [purpose, setPurpose] = useState<PaymentPurpose>("pay");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("reusable_page");
  const [customPurposeLabel, setCustomPurposeLabel] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("Payment QR");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [publicSlug, setPublicSlug] = useState("");
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [amounts, setAmounts] = useState([500, 1000, 2000]);
  const [methods, setMethods] = useState<Record<PaymentProvider, MethodState>>({
    venmo: { enabled: false, value: "" },
    cash_app: { enabled: true, value: "" },
    paypal: { enabled: false, value: "" },
    zelle: { enabled: false, value: "" },
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<ReviewQrCampaign | null>(null);
  const [previewConfig, setPreviewConfig] = useState<PaymentPageConfiguration | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [accountRes, kitRes, entRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/account`),
          fetch(`/api/reputation/review-link/${businessId}`).catch(() => null),
          fetch(`/api/reputation/payment-qr?businessId=${businessId}`),
        ]);
        if (cancelled) return;
        if (accountRes.ok) {
          const json = (await accountRes.json()) as { account?: { name?: string } };
          if (json.account?.name) {
            setBusinessName(json.account.name);
            setName(`${json.account.name} payment page`);
          }
        }
        if (kitRes?.ok) {
          const kit = (await kitRes.json()) as {
            link?: { review_url?: string };
            placeId?: string;
          };
          const dest =
            kit.link?.review_url ||
            (kit.placeId
              ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(kit.placeId)}`
              : "");
          if (dest) setGoogleReviewUrl(dest);
        }
        if (entRes.ok) {
          const json = (await entRes.json()) as {
            entitlements?: {
              reviewLinks?: boolean;
              customSlug?: boolean;
              suggestedAmounts?: boolean;
              customBranding?: boolean;
            };
          };
          const e = json.entitlements ?? {};
          setEntitlements({
            reviewLinks: Boolean(e.reviewLinks),
            customSlug: Boolean(e.customSlug),
            suggestedAmounts: Boolean(e.suggestedAmounts),
            customBranding: Boolean(e.customBranding),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const previewSlug = publicSlug.trim() || "preview";

  useEffect(() => {
    void QRCode.toDataURL(`https://app.localseoexpress.com/pay/${previewSlug}`, {
      width: 200,
      margin: 1,
      color: { dark: "#0B1B32", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [previewSlug]);

  const previewConfigMemo = useMemo((): PaymentPageConfiguration | null => {
    const enabledMethods = PAYMENT_PROVIDERS
      .filter((p) => methods[p].enabled && methods[p].value.trim())
      .map((p, i) => ({
        id: p,
        provider: p,
        publicHandle: methods[p].value,
        publicUrl: null,
        instructions: null,
        uploadedQrImageUrl: null,
        enabled: true,
        sortOrder: i,
      }));

    return {
      id: "preview",
      qrCampaignId: "preview",
      paymentMode,
      purpose,
      customPurposeLabel: purpose === "custom" ? customPurposeLabel : null,
      title: title || PAYMENT_PURPOSE_LABELS[purpose],
      description,
      thankYouMessage: "Thank you for your support!",
      logoUrl: null,
      bannerUrl: null,
      primaryColor,
      secondaryColor: null,
      allowCustomAmount: entitlements.suggestedAmounts,
      showReviewPrompt: showReviewPrompt && entitlements.reviewLinks,
      showPlatformBranding: true,
      googleReviewUrl: showReviewPrompt ? googleReviewUrl : null,
      facebookReviewUrl: null,
      websiteUrl: null,
      instagramUrl: null,
      tiktokUrl: null,
      youtubeUrl: null,
      phone: null,
      email: null,
      methods: enabledMethods,
      suggestedAmounts: entitlements.suggestedAmounts
        ? amounts.map((cents, i) => ({
            id: String(cents),
            amountCents: cents,
            label: null,
            enabled: true,
            sortOrder: i,
          }))
        : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    purpose,
    paymentMode,
    customPurposeLabel,
    title,
    description,
    primaryColor,
    methods,
    amounts,
    showReviewPrompt,
    googleReviewUrl,
    entitlements,
  ]);

  const previewCampaignMemo = useMemo((): ReviewQrCampaign => ({
    id: "preview",
    organizationId: null,
    businessId: businessId,
    ownerUserId: null,
    campaignType: "payment_review",
    publicSlug: previewSlug,
    name,
    placementType: "standard_poster",
    customPlacementLabel: null,
    destinationUrl: "",
    shortCode: "preview",
    headline: title,
    description,
    brandColor: primaryColor,
    secondaryColor: null,
    templateKey: "scan_to_pay",
    printFormat: "letter",
    showFooter: true,
    posterConfig: {
      title: title || PAYMENT_PURPOSE_LABELS[purpose],
      description,
      brandColor: primaryColor,
      showFooter: true,
      format: "letter",
      selectedPhrases: [],
    },
    status: "active",
    claimedAt: null,
    source: "app",
    migratedFromLinkId: null,
    totalScans: 0,
    estimatedUniqueScans: 0,
    botScans: 0,
    lastScannedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [businessId, name, title, description, primaryColor, purpose, previewSlug]);

  useEffect(() => {
    setPreviewConfig(previewConfigMemo);
    setPreviewCampaign(previewCampaignMemo);
  }, [previewConfigMemo, previewCampaignMemo]);

  async function publish() {
    setSaving(true);
    setError(null);
    try {
      const enabledMethods = PAYMENT_PROVIDERS
        .filter((p) => methods[p].enabled && methods[p].value.trim())
        .map((p, i) => {
          const value = methods[p].value.trim();
          const isUrl = value.startsWith("http");
          return {
            provider: p,
            publicHandle: isUrl ? null : value,
            publicUrl: isUrl ? value : null,
            enabled: true,
            sortOrder: i,
          };
        });

      if (enabledMethods.length === 0) {
        throw new Error("Enable at least one payment method.");
      }

      const res = await fetch("/api/reputation/payment-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim() || "Payment QR",
          purpose,
          customPurposeLabel: purpose === "custom" ? customPurposeLabel : null,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          primaryColor,
          publicSlug: entitlements.customSlug && publicSlug.trim() ? publicSlug.trim() : null,
          showReviewPrompt: showReviewPrompt && entitlements.reviewLinks,
          googleReviewUrl: showReviewPrompt ? googleReviewUrl : null,
          methods: enabledMethods,
          suggestedAmounts: entitlements.suggestedAmounts
            ? amounts.map((cents, i) => ({ amountCents: cents, sortOrder: i }))
            : [],
          allowCustomAmount: entitlements.suggestedAmounts,
          paymentMode,
          headline: title || PAYMENT_PURPOSE_LABELS[purpose],
          templateKey: "scan_to_pay",
        }),
      });
      const json = (await res.json()) as {
        campaign?: ReviewQrCampaign;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not create payment page");
      if (json.campaign?.id) {
        router.push(`${base}/${json.campaign.id}`);
      } else {
        router.push(base);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create payment page");
    } finally {
      setSaving(false);
    }
  }

  function canContinue(): boolean {
    if (step === 1) return purpose !== "custom" || customPurposeLabel.trim().length > 0;
    if (step === 2) {
      return PAYMENT_PROVIDERS.some((p) => methods[p].enabled && methods[p].value.trim());
    }
    return true;
  }

  return (
    <ModulePage className="space-y-6">
      <div>
        <Link href={base} className="text-sm font-medium text-[#64748B] hover:text-[#0B1B32]">
          ← All campaigns
        </Link>
        <h1 className={cn(qrUi.title, "mt-3")}>Payment, Tip &amp; Review QR</h1>
        <p className={qrUi.subtitle}>
          Create a hosted payment page and one QR code for Venmo, Cash App, PayPal, and Zelle.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id < step && setStep(s.id)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
              step === s.id
                ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                : step > s.id
                  ? "border-[#D0D5DD] bg-white text-[#344054]"
                  : "border-[#E6EAF0] bg-[#F9FAFB] text-[#98A2B3]"
            )}
          >
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px]">
              {step > s.id ? <Check className="h-3 w-3" /> : s.id}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className={cn(qrUi.cardPad)}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : null}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">What&apos;s the page for?</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Choose how customers will use this page. You can edit the heading later.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PAYMENT_PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left transition",
                    purpose === p
                      ? "border-[#2563EB] bg-[#EFF6FF]"
                      : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                  )}
                >
                  <span className="text-2xl">{PURPOSE_ICONS[p]}</span>
                  <p className="mt-2 text-sm font-bold text-[#0B1B32]">
                    {PAYMENT_PURPOSE_LABELS[p]}
                  </p>
                </button>
              ))}
            </div>
            {purpose === "custom" && (
              <input
                value={customPurposeLabel}
                onChange={(e) => setCustomPurposeLabel(e.target.value)}
                className={qrUi.input}
                placeholder="Custom heading"
              />
            )}
            <div>
              <h3 className="text-sm font-bold text-[#0B1B32]">Page type</h3>
              <p className="mt-1 text-sm text-[#667085]">
                Choose whether customers enter the amount or you send a specific payment request.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {PAYMENT_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={cn(
                      "rounded-2xl border-2 p-4 text-left transition",
                      paymentMode === mode
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                    )}
                  >
                    <p className="text-sm font-bold text-[#0B1B32]">
                      {PAYMENT_MODE_LABELS[mode]}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {mode === "reusable_page"
                        ? "One permanent link or QR. Customers enter or pick an amount, then choose a provider."
                        : "Template for one-off requests. You set amount and note, then share a unique link or QR per job."}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={qrUi.label}>Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
              />
            </div>
            <div>
              <label className={qrUi.label}>Business</label>
              <p className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold text-[#0B1B32]">
                {businessName}
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">Payment methods</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Add your public payment handles. Money goes directly to your accounts.
              </p>
            </div>
            {PAYMENT_PROVIDERS.map((provider) => {
              const def = getPaymentProvider(provider);
              const state = methods[provider];
              return (
                <div
                  key={provider}
                  className="rounded-2xl border border-[#E2E8F0] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ background: def.brandColor }}
                      >
                        {def.displayName.charAt(0)}
                      </span>
                      <div>
                        <p className="font-bold text-[#0B1B32]">{def.displayName}</p>
                        <p className="text-xs text-[#64748B]">
                          {provider === "cash_app" && "Payment link or Cashtag ($username)"}
                          {provider === "venmo" && "Username"}
                          {provider === "paypal" && "PayPal.me link"}
                          {provider === "zelle" && "Email or phone"}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={state.enabled}
                        onChange={(e) =>
                          setMethods((m) => ({
                            ...m,
                            [provider]: { ...m[provider], enabled: e.target.checked },
                          }))
                        }
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-[#E2E8F0] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#2563EB] peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                  {state.enabled && (
                    <input
                      value={state.value}
                      onChange={(e) =>
                        setMethods((m) => ({
                          ...m,
                          [provider]: { ...m[provider], value: e.target.value },
                        }))
                      }
                      className={cn(qrUi.input, "mt-3")}
                      placeholder={
                        provider === "cash_app"
                          ? "https://cash.app/... or $cashtag"
                          : provider === "paypal"
                            ? "paypal.me/you"
                            : provider === "zelle"
                              ? "email@example.com"
                              : "username"
                      }
                    />
                  )}
                </div>
              );
            })}

            {entitlements.suggestedAmounts && (
              <div>
                <label className={qrUi.label}>Suggested amounts ($)</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {amounts.map((cents, i) => (
                    <input
                      key={i}
                      type="number"
                      value={cents / 100}
                      onChange={(e) => {
                        const v = Math.round(parseFloat(e.target.value) * 100);
                        setAmounts((a) => a.map((x, j) => (j === i ? v : x)));
                      }}
                      className={qrUi.input}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#0B1B32]">Customize appearance</h2>
              <div>
                <label className={qrUi.label}>Page title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  placeholder={PAYMENT_PURPOSE_LABELS[purpose]}
                />
              </div>
              <div>
                <label className={qrUi.label}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5 min-h-[80px]")}
                  rows={3}
                />
              </div>
              <div>
                <label className={qrUi.label}>Theme color</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-[#E2E8F0]"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className={qrUi.input}
                  />
                </div>
              </div>
              {entitlements.customSlug && (
                <div>
                  <label className={qrUi.label}>Custom page slug</label>
                  <input
                    value={publicSlug}
                    onChange={(e) => setPublicSlug(e.target.value.toLowerCase())}
                    className={cn(qrUi.input, "mt-1.5")}
                    placeholder="thelocalshop"
                  />
                  <p className="mt-1 text-xs text-[#64748B]">
                    app.localseoexpress.com/pay/{publicSlug || "your-slug"}
                  </p>
                </div>
              )}
              {entitlements.reviewLinks && (
                <div className="rounded-2xl border border-[#E2E8F0] p-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={showReviewPrompt}
                      onChange={(e) => setShowReviewPrompt(e.target.checked)}
                      className="h-4 w-4 rounded border-[#CBD5E1]"
                    />
                    <span className="text-sm font-semibold text-[#0B1B32]">
                      Show Google review request after payment
                    </span>
                  </label>
                  <p className="mt-2 text-xs text-[#64748B]">
                    Neutral wording: &quot;Share your experience on Google.&quot;
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#64748B]">
                <Smartphone className="h-4 w-4" /> Mobile preview
              </p>
              <div className="w-[320px] overflow-hidden rounded-[2rem] border-4 border-[#0B1B32] shadow-2xl">
                {previewCampaign && previewConfig && (
                  <div className="h-[520px] overflow-y-auto">
                    <PaymentPublicPage
                      slug={previewSlug}
                      campaign={previewCampaign}
                      config={previewConfig}
                      businessName={businessName}
                      isPreview
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#0B1B32]">QR &amp; poster</h2>
              {qrDataUrl && (
                <div className="flex flex-col items-center rounded-2xl border border-[#E2E8F0] bg-white p-6">
                  <img src={qrDataUrl} alt="QR code preview" className="h-40 w-40" />
                  <p className="mt-3 text-xs text-[#64748B]">
                    app.localseoexpress.com/pay/{previewSlug}
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#1e3a5f] p-6 text-center text-white">
                <p className="text-lg font-extrabold">Scan to pay</p>
                <p className="mt-1 text-sm text-white/80">{businessName}</p>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt=""
                    className="mx-auto mt-4 h-32 w-32 rounded-lg bg-white p-2"
                  />
                )}
                <p className="mt-3 text-xs text-white/70">Scan to pay with Venmo, Cash App, PayPal, or Zelle</p>
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-[#64748B]">Live page preview</p>
              {previewCampaign && previewConfig && (
                <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-lg">
                  <PaymentPublicPage
                    slug={previewSlug}
                    campaign={previewCampaign}
                    config={previewConfig}
                    businessName={businessName}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={step <= 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className={cn(qrUi.btnSecondary, "disabled:opacity-40")}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            disabled={!canContinue()}
            onClick={() => setStep((s) => s + 1)}
            className={cn(qrUi.btnPrimary, "disabled:opacity-40")}
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void publish()}
            className={cn(qrUi.btnPrimary, "bg-[#2563EB] hover:bg-[#1D4ED8]")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publish payment page
          </button>
        )}
      </div>
    </ModulePage>
  );
}
