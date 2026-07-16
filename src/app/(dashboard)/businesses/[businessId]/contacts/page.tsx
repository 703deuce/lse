import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ContactsPageClient } from "@/components/reputation/contacts-page-client";

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");
  return <ContactsPageClient businessId={businessId} allowed={allowed} />;
}
