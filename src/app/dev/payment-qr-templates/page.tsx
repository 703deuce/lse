import { notFound } from "next/navigation";
import { PaymentTemplatesShowcase } from "@/components/reputation/payment-qr/payment-templates-showcase";

/** All Pay & Review Page visual templates for screenshot capture. */
export default function PaymentQrTemplatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PaymentTemplatesShowcase />;
}
