"use client";

import type { PosterConfig } from "@/lib/reputation/review-requests";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import { PaymentHostedCenter } from "@/components/reputation/payment-qr/payment-hosted-center";
import type { PaymentPageConfiguration, PaymentRequestSession } from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

const DARK_POSTER_KEYS = new Set([
  "elegant_black",
  "premium_gold",
  "black_white",
  "cafe_coffee",
  "rustic_wood",
]);

function posterConfigFromCampaign(campaign: ReviewQrCampaign, config: PaymentPageConfiguration): PosterConfig {
  return {
    title: config.title ?? campaign.headline ?? "Pay securely",
    description: config.description ?? campaign.description ?? "",
    brandColor: config.primaryColor ?? campaign.brandColor ?? "#137752",
    showFooter: campaign.showFooter,
    format: campaign.printFormat === "a5" ? "a5" : campaign.printFormat === "letter" ? "letter" : "a4",
    selectedPhrases: [],
  };
}

/**
 * Hosted Pay & Review page — same brand theme as the printed poster;
 * QR slot becomes payment methods + review CTA.
 */
export function BrandThemeHostedPage({
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
  const poster = posterConfigFromCampaign(campaign, config);
  const dark = DARK_POSTER_KEYS.has(campaign.templateKey);

  const center = (
    <PaymentHostedCenter slug={slug} config={config} isPreview={isPreview} dark={dark} />
  );

  return (
    <div
      className={cn(
        "flex min-h-screen items-start justify-center px-3 py-6 sm:py-10",
        "bg-[#E8ECF2]"
      )}
    >
      <div className="w-full max-w-[360px]">
        <ReviewPosterPreview
          businessName={businessName}
          poster={poster}
          qrDataUrl={null}
          templateKey={campaign.templateKey}
          centerContent={center}
          animateHostedEntry={!isPreview}
        />
        {requestSession ? (
          <p className="mt-3 text-center text-xs text-[#667085]">
            Requested amount: ${(requestSession.amountCents / 100).toFixed(2)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
