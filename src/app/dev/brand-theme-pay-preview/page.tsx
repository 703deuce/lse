import { notFound } from "next/navigation";
import { BrandThemeHostedPage } from "@/components/reputation/payment-qr/brand-theme-hosted-page";
import { MOCK_CAMPAIGN, MOCK_CONFIG } from "@/lib/reputation/payment-qr/showcase-mock";
import { normalizePosterTemplateKey, type PosterTemplateKey } from "@/lib/reputation/poster-templates";

/** Static brand-theme hosted page preview — matches post-scan customer view on master. */
export default async function BrandThemePayPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { theme } = await searchParams;
  const templateKey = normalizePosterTemplateKey(theme ?? "clear_blue") as PosterTemplateKey;

  const campaign = {
    ...MOCK_CAMPAIGN,
    templateKey,
    headline: "Junk Removal Woodbridge",
    description: "Service beyond the tap",
    name: "Junk Removal Woodbridge",
  };
  const config = {
    ...MOCK_CONFIG,
    title: "Junk Removal Woodbridge",
    description: "Service beyond the tap",
    pageTheme: "modern_blue",
    primaryColor: "#2563EB",
  };

  return (
    <BrandThemeHostedPage
      slug="preview"
      campaign={campaign}
      config={config}
      businessName="Junk Removal Woodbridge"
      isPreview
    />
  );
}
