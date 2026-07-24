import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ContactsPageClient } from "@/components/reputation/contacts-page-client";
import {
  REPUTATION_CONTACTS_PREVIEW_TOTAL,
  reputationContactsPreviewData,
  reputationContactsPreviewKpis,
} from "@/lib/reputation/reputation-page-preview-data";

export default async function ReputationContactsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessAccess(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  return (
    <ContactsPageClient
      businessId={businessId}
      allowed={allowed}
      initialContacts={isPreview ? reputationContactsPreviewData : undefined}
      previewStats={isPreview ? reputationContactsPreviewKpis : undefined}
      previewTotalCount={isPreview ? REPUTATION_CONTACTS_PREVIEW_TOTAL : undefined}
    />
  );
}
