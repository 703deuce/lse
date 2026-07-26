import Link from "next/link";
import { notFound } from "next/navigation";
import { getQrCampaignByShortCode } from "@/lib/reputation/qr-campaigns";
import { sanitizeReviewRedirectUrl } from "@/lib/security/safe-redirect";
import { QrScanLanding } from "@/components/reputation/qr-campaigns/qr-scan-landing";

export default async function QrScanLandingPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  const campaign = await getQrCampaignByShortCode(shortCode);
  if (!campaign || campaign.status !== "active") {
    notFound();
  }
  const destination = sanitizeReviewRedirectUrl(campaign.destinationUrl);
  if (!destination) notFound();

  return (
    <QrScanLanding
      businessName={campaign.name.replace(/ QR.*$/i, "") || "this business"}
      brandColor={campaign.brandColor}
      headline={campaign.headline}
      description={campaign.description}
      destinationUrl={destination}
    />
  );
}
