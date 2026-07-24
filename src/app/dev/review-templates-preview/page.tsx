"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { TemplatesHub } from "@/components/reputation/templates-hub";
import {
  REPUTATION_PREVIEW_BUSINESS_ID,
  REPUTATION_PREVIEW_BUSINESS_NAME,
  reputationTemplatesPreviewData,
  reputationTemplatesPreviewKpis,
} from "@/lib/reputation/reputation-page-preview-data";

export default function ReviewTemplatesPreviewPage() {
  const path = `/businesses/${REPUTATION_PREVIEW_BUSINESS_ID}/reputation/templates`;

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
        <TemplatesHub businessId={REPUTATION_PREVIEW_BUSINESS_ID} initialTemplates={reputationTemplatesPreviewData} previewKpis={reputationTemplatesPreviewKpis} />
      </main>
    </div>
  );
}
