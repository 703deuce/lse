import { notFound } from "next/navigation";
import { getPaymentPageBySlug } from "@/lib/reputation/payment-qr/service";
import { createServiceClient } from "@/lib/db/client";
import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";

async function loadBusinessName(businessId: string | null): Promise<string | null> {
  if (!businessId) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle();
    return (data?.name as string | null) ?? null;
  } catch {
    return null;
  }
}

export default async function PaymentPublicPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPaymentPageBySlug(slug);
  if (!page) notFound();

  const businessName = await loadBusinessName(page.campaign.businessId);

  return (
    <PaymentPublicPage
      slug={slug}
      campaign={page.campaign}
      config={page.config}
      businessName={businessName ?? page.campaign.name}
      requestSession={page.requestSession}
      paymentMode={page.paymentMode}
    />
  );
}
