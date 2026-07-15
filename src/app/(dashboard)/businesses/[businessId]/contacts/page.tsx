import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ContactsPageClient } from "@/components/reputation/contacts-page-client";

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessAccess(businessId);
  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");
  return <ContactsPageClient businessId={businessId} allowed={allowed} />;
}
