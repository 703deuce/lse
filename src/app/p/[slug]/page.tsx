import { notFound } from "next/navigation";
import { getPaymentPageBySlug } from "@/lib/reputation/payment-qr/service";
import { createServiceClient } from "@/lib/db/client";
import { BrandThemeHostedPage } from "@/components/reputation/payment-qr/brand-theme-hosted-page";

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

/** Canonical public Pay & Review Page: /p/{slug} */
export default async function PermanentPaymentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPaymentPageBySlug(slug);
  if (!page) notFound();

  const businessName = await loadBusinessName(page.campaign.businessId);

  return (
    <BrandThemeHostedPage
      slug={slug}
      campaign={page.campaign}
      config={page.config}
      businessName={businessName ?? page.campaign.name}
      requestSession={page.requestSession}
    />
  );
}
