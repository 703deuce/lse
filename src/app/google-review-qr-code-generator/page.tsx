import type { Metadata } from "next";
import { GoogleReviewQrSeoLanding } from "@/components/reputation/qr-campaigns/google-review-qr-seo-landing";

export const metadata: Metadata = {
  title: "Google Review Link & QR Code Generator (Free) | Local SEO Express",
  description:
    "Create a Google review link and QR code in seconds. Design a printable QR poster, customize colors, and download instantly. Track scans after free signup.",
  alternates: {
    canonical: "https://localseoexpress.com/tools/google-review-link-qr-code/",
  },
  openGraph: {
    title: "Free Google Review Link & QR Code Generator",
    description:
      "Create a printable Google review QR poster free. Customize, download, then track scans with a free Local SEO Express account.",
    url: "https://localseoexpress.com/tools/google-review-link-qr-code/",
  },
};

export default async function GoogleReviewQrCodeGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1" || params.embed === "true";
  return <GoogleReviewQrSeoLanding embed={embed} />;
}
