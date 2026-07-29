import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import { QrCampaignTypeSelector } from "@/components/reputation/payment-qr/qr-campaign-type-selector";
import type { PaymentPageConfiguration } from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";

const mockCampaign: ReviewQrCampaign = {
  id: "preview",
  organizationId: null,
  businessId: "preview",
  ownerUserId: null,
  campaignType: "payment_review",
  publicSlug: "thelocalshop",
  name: "The Local Shop",
  placementType: "standard_poster",
  customPlacementLabel: null,
  destinationUrl: "",
  shortCode: "preview",
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
  totalScans: 0,
  estimatedUniqueScans: 0,
  botScans: 0,
  lastScannedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockConfig: PaymentPageConfiguration = {
  id: "preview",
  qrCampaignId: "preview",
  purpose: "pay",
  customPurposeLabel: null,
  title: "Pay The Local Shop",
  description: "Choose your payment method below",
  thankYouMessage: "Thank you for your support!",
  logoUrl: null,
  bannerUrl: null,
  primaryColor: "#2563EB",
  secondaryColor: null,
  allowCustomAmount: true,
  showReviewPrompt: true,
  showPlatformBranding: true,
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJpreview",
  facebookReviewUrl: null,
  websiteUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  phone: null,
  email: null,
  methods: [
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

export default function PaymentQrPreviewPage() {
  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <div className="border-b border-[#E2E8F0] bg-white px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
          Dev preview — Payment, Tip &amp; Review QR
        </p>
      </div>
      <div className="mx-auto max-w-6xl space-y-12 p-6">
        <section>
          <h2 className="mb-4 text-lg font-bold text-[#0B1B32]">Campaign type selector</h2>
          <QrCampaignTypeSelector businessId="preview-business" />
        </section>
        <section>
          <h2 className="mb-4 text-lg font-bold text-[#0B1B32]">Public payment page</h2>
          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] shadow-lg">
            <PaymentPublicPage
              slug="thelocalshop"
              campaign={mockCampaign}
              config={mockConfig}
              businessName="The Local Shop"
              isPreview
            />
          </div>
        </section>
      </div>
    </div>
  );
}
