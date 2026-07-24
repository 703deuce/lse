"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { ContactsPageClient } from "@/components/reputation/contacts-page-client";
import {
  REPUTATION_PREVIEW_BUSINESS_ID,
  REPUTATION_PREVIEW_BUSINESS_NAME,
  reputationContactsPreviewData,
} from "@/lib/reputation/reputation-page-preview-data";

export default function ReviewContactsPreviewPage() {
  const path = `/businesses/${REPUTATION_PREVIEW_BUSINESS_ID}/reputation/contacts`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={REPUTATION_PREVIEW_BUSINESS_ID}
        pathname={path}
        businessName={REPUTATION_PREVIEW_BUSINESS_NAME}
        staticLinks
        showFooter={false}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <ContactsPageClient
          businessId={REPUTATION_PREVIEW_BUSINESS_ID}
          allowed
          initialContacts={reputationContactsPreviewData}
        />
      </main>
    </div>
  );
}
