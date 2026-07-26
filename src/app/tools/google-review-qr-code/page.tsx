import type { Metadata } from "next";
import { PublicQrGenerator } from "@/components/reputation/qr-campaigns/public-qr-generator";

export const metadata: Metadata = {
  title: "Free Google Review QR Code Generator | Local SEO Express",
  description:
    "Create a free printable Google review QR code poster in seconds. Track scans with a short link, then send customers to leave a Google review.",
  openGraph: {
    title: "Free Google Review QR Code Generator",
    description:
      "Design a print-ready Google review poster with a tracked QR code — free, no account required to generate.",
  },
};

export default function GoogleReviewQrCodeToolPage() {
  return <PublicQrGenerator />;
}
