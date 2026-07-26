import type { Metadata } from "next";
import { GoogleReviewQrSeoLanding } from "@/components/reputation/qr-campaigns/google-review-qr-seo-landing";

export const metadata: Metadata = {
  title: "Google Review QR Code Generator (Free) | Create a Google Review QR Code",
  description:
    "Create a Google Review QR Code in seconds with our free Google Review QR Code Generator. Design a printable QR poster, customize colors, and download instantly. Track scans after free signup.",
  alternates: {
    canonical: "https://localseoexpress.com/google-review-qr-code-generator/",
  },
  openGraph: {
    title: "Free Google Review QR Code Generator",
    description:
      "Create a printable Google Review QR Code poster free. Customize, download, then track scans with a free Local SEO Express account.",
    url: "https://localseoexpress.com/google-review-qr-code-generator/",
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
