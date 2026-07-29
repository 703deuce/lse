"use client";

import { BarChart3, Copy, ExternalLink, Plus, Wallet } from "lucide-react";
import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import { QrCampaignTypeSelector } from "@/components/reputation/payment-qr/qr-campaign-type-selector";
import {
  QrKpiCard,
  QrStatusBadge,
  qrUi,
} from "@/components/reputation/qr-campaigns/qr-ui";
import {
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_PURPOSES,
  PAYMENT_PROVIDERS,
  type PaymentPageConfiguration,
} from "@/lib/reputation/payment-qr/types";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

export const MOCK_CAMPAIGN: ReviewQrCampaign = {
  id: "preview",
  organizationId: null,
  businessId: "preview",
  ownerUserId: null,
  campaignType: "payment_review",
  publicSlug: "thelocalshop",
  name: "The Local Shop — Counter",
  placementType: "counter_sign",
  customPlacementLabel: null,
  destinationUrl: "",
  shortCode: "abc123xyz",
  headline: "Pay The Local Shop",
  description: "Choose your payment method below",
  brandColor: "#2563EB",
  secondaryColor: null,
  templateKey: "scan_to_pay",
  printFormat: "letter",
  showFooter: true,
  posterConfig: {
    title: "Scan to pay",
    description: "Venmo, Cash App, PayPal, or Zelle",
    brandColor: "#2563EB",
    showFooter: true,
    format: "letter",
    selectedPhrases: [],
  },
  status: "active",
  claimedAt: null,
  source: "app",
  migratedFromLinkId: null,
  totalScans: 148,
  estimatedUniqueScans: 112,
  botScans: 3,
  lastScannedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_CONFIG: PaymentPageConfiguration = {
  id: "preview",
  qrCampaignId: "preview",
  paymentMode: "reusable_page",
  amountMode: "suggested",
  purpose: "pay",
  customPurposeLabel: null,
  title: "Pay The Local Shop",
  description: "Fast, friendly service in Woodbridge, Virginia",
  thankYouMessage: "Thank you for your support!",
  paymentNote: null,
  logoUrl: null,
  bannerUrl: null,
  primaryColor: "#2563EB",
  secondaryColor: null,
  allowCustomAmount: true,
  showReviewPrompt: true,
  showPlatformBranding: true,
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJpreview",
  facebookReviewUrl: "https://facebook.com/thelocalshop/reviews",
  websiteUrl: "https://thelocalshop.com",
  facebookPageUrl: "https://facebook.com/thelocalshop",
  instagramUrl: "https://instagram.com/thelocalshop",
  pinterestUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  bookingUrl: null,
  phone: null,
  email: null,
  methods: [
    {
      id: "0",
      provider: "stripe",
      publicHandle: null,
      publicUrl: "https://buy.stripe.com/preview",
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 0,
    },
    {
      id: "1",
      provider: "venmo",
      publicHandle: "thelocalshop",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 0,
    },
    {
      id: "2",
      provider: "cash_app",
      publicHandle: "$thelocalshop",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "3",
      provider: "paypal",
      publicHandle: "thelocalshop",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 2,
    },
    {
      id: "4",
      provider: "zelle",
      publicHandle: "pay@thelocalshop.com",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 3,
    },
  ],
  suggestedAmounts: [
    { id: "5", amountCents: 500, label: null, enabled: true, sortOrder: 0 },
    { id: "10", amountCents: 1000, label: null, enabled: true, sortOrder: 1 },
    { id: "20", amountCents: 2000, label: null, enabled: true, sortOrder: 2 },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_REQUEST_SESSION = {
  id: "session-preview",
  qrCampaignId: "preview",
  organizationId: null,
  businessId: "preview",
  shortCode: "req125abc",
  amountCents: 12500,
  currency: "USD",
  note: "Garage cleanout",
  status: "active" as const,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function ShowcaseSection({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#0B1B32]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[#64748B]">{description}</p> : null}
      </div>
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

function WizardStepMock({
  step,
  active,
  label,
}: {
  step: number;
  active?: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-xl border px-3.5 py-2 text-xs font-semibold",
        active
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
          : "border-[#D0D5DD] bg-white text-[#344054]"
      )}
    >
      <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px]">
        {step}
      </span>
      {label}
    </span>
  );
}

export function PaymentQrShowcase() {
  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <div className="border-b border-[#E2E8F0] bg-white px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
          Payment, Tip &amp; Review QR — UI showcase
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#0B1B32]">
          All screens (dev preview)
        </h1>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <ShowcaseSection
          id="campaign-list"
          title="1. QR Campaign dashboard"
          description="List view with payment campaign badge and scan totals."
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={qrUi.title}>QR Campaigns</h3>
                <p className={qrUi.subtitle}>
                  Google review QR and Payment, Tip &amp; Review QR campaigns.
                </p>
              </div>
              <button type="button" className={qrUi.btnPrimary}>
                <Plus className="h-4 w-4" /> Create New Campaign
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <QrKpiCard label="Total Campaigns" value="3" />
              <QrKpiCard label="Total Scans" value="204" />
              <QrKpiCard label="Est. Unique" value="156" />
              <QrKpiCard label="Active Campaigns" value="2" />
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-xs uppercase text-[#98A2B3]">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Scans</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E6EAF0]">
                  <td className="px-4 py-3 font-semibold">The Local Shop — Counter</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-xs font-bold text-[#1D4ED8]">
                      Payment QR
                    </span>
                  </td>
                  <td className="px-4 py-3">148</td>
                  <td className="px-4 py-3"><QrStatusBadge status="active" /></td>
                </tr>
                <tr className="border-b border-[#E6EAF0]">
                  <td className="px-4 py-3 font-semibold">Front desk review poster</td>
                  <td className="px-4 py-3 text-[#64748B]">Review QR</td>
                  <td className="px-4 py-3">56</td>
                  <td className="px-4 py-3"><QrStatusBadge status="active" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="type-selector"
          title="2. Create campaign — choose type"
          description="Google Review QR or Payment, Tip & Review QR."
        >
          <div className="p-6">
            <QrCampaignTypeSelector businessId="preview-business" />
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="wizard-basic"
          title="3. Wizard — Basic details"
          description="Page purpose and business info."
        >
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              <WizardStepMock step={1} active label="Basic details" />
              <WizardStepMock step={2} label="Payment methods" />
              <WizardStepMock step={3} label="Customizing" />
              <WizardStepMock step={4} label="Preview & publish" />
            </div>
            <h3 className="text-lg font-bold">What&apos;s the page for?</h3>
            <div className="grid grid-cols-3 gap-3">
              {PAYMENT_PURPOSES.slice(0, 6).map((p) => (
                <div
                  key={p}
                  className={cn(
                    "rounded-2xl border-2 p-4",
                    p === "pay" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0]"
                  )}
                >
                  <p className="text-sm font-bold">{PAYMENT_PURPOSE_LABELS[p]}</p>
                </div>
              ))}
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="wizard-methods"
          title="4. Wizard — Payment methods"
          description="Venmo, Cash App, PayPal, Zelle toggles and handles."
        >
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <WizardStepMock step={1} label="Basic details" />
              <WizardStepMock step={2} active label="Payment methods" />
              <WizardStepMock step={3} label="Customizing" />
              <WizardStepMock step={4} label="Preview & publish" />
            </div>
            {PAYMENT_PROVIDERS.map((provider) => {
              const def = getPaymentProvider(provider);
              return (
                <div key={provider} className="rounded-2xl border border-[#E2E8F0] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ background: def.brandColor }}
                      >
                        {def.displayName.charAt(0)}
                      </span>
                      <p className="font-bold">{def.displayName}</p>
                    </div>
                    <div className="h-6 w-11 rounded-full bg-[#2563EB]" />
                  </div>
                  <input
                    readOnly
                    value={
                      provider === "cash_app"
                        ? "$thelocalshop"
                        : provider === "zelle"
                          ? "pay@thelocalshop.com"
                          : "thelocalshop"
                    }
                    className={cn(qrUi.input, "mt-3")}
                  />
                </div>
              );
            })}
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="wizard-customize"
          title="5. Wizard — Customizing"
          description="Theme color, custom slug, review prompt, mobile preview."
        >
          <div className="p-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <WizardStepMock step={1} label="Basic details" />
                <WizardStepMock step={2} label="Payment methods" />
                <WizardStepMock step={3} active label="Customizing" />
                <WizardStepMock step={4} label="Preview & publish" />
              </div>
              <input className={qrUi.input} readOnly value="Pay The Local Shop" />
              <div className="flex gap-3">
                <input type="color" value="#2563EB" readOnly className="h-10 w-14 rounded-lg" />
                <input className={qrUi.input} readOnly value="#2563EB" />
              </div>
              <input className={qrUi.input} readOnly value="thelocalshop" placeholder="Custom slug" />
            </div>
            <div className="mx-auto w-[300px] overflow-hidden rounded-[2rem] border-4 border-[#0B1B32]">
              <PaymentPublicPage
                slug="thelocalshop"
                campaign={MOCK_CAMPAIGN}
                config={MOCK_CONFIG}
                businessName="The Local Shop"
                isPreview
              />
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="public-page"
          title="6. Pay & Review Page (public)"
          description="Single hosted page — payment methods, reviews, and social links together."
        >
          <PaymentPublicPage
            slug="thelocalshop"
            campaign={MOCK_CAMPAIGN}
            config={MOCK_CONFIG}
            businessName="The Local Shop"
            isPreview
          />
        </ShowcaseSection>

        <ShowcaseSection
          id="campaign-editor"
          title="7. Campaign editor"
          description="QR code, tracked link, and scan to pay poster."
        >
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-extrabold">The Local Shop — Counter</h3>
              <QrStatusBadge status="active" />
              <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-bold text-[#1D4ED8]">
                Payment QR
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <QrKpiCard label="QR scans" value="148" />
              <QrKpiCard label="Est. unique" value="112" />
              <QrKpiCard label="Short code" value="abc123xyz" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn(qrUi.btnSecondary, "inline-flex gap-2")}>
                <BarChart3 className="h-4 w-4" /> Analytics
              </button>
              <button type="button" className={cn(qrUi.btnSecondary, "inline-flex gap-2")}>
                <Copy className="h-4 w-4" /> Copy link
              </button>
              <button type="button" className={cn(qrUi.btnPrimary, "inline-flex gap-2 bg-[#2563EB]")}>
                <ExternalLink className="h-4 w-4" /> Open public page
              </button>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#1e3a5f] p-8 text-center text-white">
              <Wallet className="mx-auto h-8 w-8" />
              <p className="mt-3 text-xl font-extrabold">Scan to pay</p>
              <p className="text-sm text-white/80">The Local Shop</p>
              <div className="mx-auto mt-6 h-32 w-32 rounded-lg bg-white/10" />
              <p className="mt-4 text-xs text-white/70">Venmo · Cash App · PayPal · Zelle</p>
            </div>
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          id="analytics"
          title="10. Payment analytics dashboard"
          description="Payment-option clicks, provider breakdown, CSV export."
        >
          <PaymentQrAnalyticsMock />
        </ShowcaseSection>
      </div>
    </div>
  );
}

function PaymentQrAnalyticsMock() {
  const mockData = {
    pageViews: 204,
    uniqueVisitors: 156,
    qrScans: 148,
    paymentLinkClicks: 89,
    googleReviewClicks: 19,
    facebookReviewClicks: 0,
    providerClicks: { stripe: 15, cash_app: 42, zelle: 31, venmo: 22, paypal: 11 },
    socialLinkClicks: 12,
    websiteClicks: 8,
    bookingLinkClicks: 2,
    conversionRates: {
      scanToPageView: 0.92,
      pageViewToPaymentClick: 0.44,
      pageViewToReviewClick: 0.09,
    },
    recentActivity: [
      {
        id: "1",
        eventType: "cash_app_clicked",
        provider: "cash_app",
        amountSelectedCents: 1000,
        createdAt: new Date().toISOString(),
        deviceCategory: "mobile",
      },
      {
        id: "2",
        eventType: "google_review_clicked",
        provider: null,
        amountSelectedCents: null,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        deviceCategory: "mobile",
      },
    ],
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={qrUi.title}>Payment page analytics</h3>
          <p className={qrUi.subtitle}>Payment-option clicks — not verified payments.</p>
        </div>
        <button type="button" className={cn(qrUi.btnSecondary, "inline-flex gap-2")}>
          Export CSV
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <QrKpiCard label="Page views" value={String(mockData.pageViews)} />
        <QrKpiCard label="QR scans" value={String(mockData.qrScans)} />
        <QrKpiCard label="Payment-link clicks" value={String(mockData.paymentLinkClicks)} />
        <QrKpiCard label="Review-link clicks" value={String(mockData.googleReviewClicks)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(qrUi.cardPad)}>
          <h4 className="text-sm font-bold">Clicks by provider</h4>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(mockData.providerClicks).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k.replace("_", " ")} selected</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn(qrUi.cardPad)}>
          <h4 className="text-sm font-bold">Conversion rates</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Page view → payment click</span>
              <strong>44%</strong>
            </li>
            <li className="flex justify-between">
              <span>Page view → review click</span>
              <strong>9%</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
