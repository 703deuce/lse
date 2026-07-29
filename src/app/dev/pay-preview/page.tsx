import { notFound } from "next/navigation";
import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import { MOCK_CAMPAIGN, MOCK_CONFIG } from "@/lib/reputation/payment-qr/showcase-mock";

/** Static public payment page preview — no database required. */
export default function PayPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <PaymentPublicPage
      slug="thelocalshop"
      campaign={MOCK_CAMPAIGN}
      config={MOCK_CONFIG}
      businessName="The Local Shop"
      isPreview
    />
  );
}
