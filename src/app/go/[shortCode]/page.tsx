import { notFound } from "next/navigation";
import { getQrCampaignByShortCode } from "@/lib/reputation/qr-campaigns";
import { createServiceClient } from "@/lib/db/client";
import { sanitizeReviewRedirectUrl } from "@/lib/security/safe-redirect";
import { QrScanLanding } from "@/components/reputation/qr-campaigns/qr-scan-landing";

async function loadBusinessLabel(businessId: string | null): Promise<{
  name: string | null;
  location: string | null;
}> {
  if (!businessId) return { name: null, location: null };
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("businesses")
      .select("name, city, address_text")
      .eq("id", businessId)
      .maybeSingle();
    if (!data) return { name: null, location: null };
    const city =
      (data.city as string | null) ||
      (typeof data.address_text === "string"
        ? data.address_text.split(",").map((p: string) => p.trim()).slice(-2, -1)[0] ?? null
        : null);
    return {
      name: (data.name as string | null) ?? null,
      location: city,
    };
  } catch {
    return { name: null, location: null };
  }
}

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

  const biz = await loadBusinessLabel(campaign.businessId);
  const businessName =
    biz.name ||
    campaign.name.replace(/\s+(poster|qr|campaign).*$/i, "").trim() ||
    "this business";

  return (
    <QrScanLanding
      businessName={businessName}
      locationLabel={biz.location}
      brandColor={campaign.brandColor}
      headline={campaign.headline}
      description={campaign.description}
      destinationUrl={destination}
    />
  );
}
