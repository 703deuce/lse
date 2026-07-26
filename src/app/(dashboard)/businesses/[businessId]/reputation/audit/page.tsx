import { Suspense } from "react";
import { ReputationAuditDashboard } from "@/components/reputation/reputation-audit-dashboard";
import { ReputationStrategyReport } from "@/components/reputation/reputation-modules-audit-dashboard";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadReputationModulesAudit } from "@/lib/reputation/reputation-modules-audit";
import { reputationAuditPreviewData } from "@/lib/reputation/reputation-page-preview-data";

export default async function ReputationAuditPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  const isPreview = isDevPreviewBusiness(businessId);
  const data = isPreview ? reputationAuditPreviewData : await loadReputationModulesAudit(businessId);

  return (
    <div className="space-y-6">
      <ReputationStrategyReport businessId={businessId} data={data} />
      {!isPreview ? (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-[14px] font-semibold text-zinc-900">
            Run deep audit legacy flow
          </summary>
          <div className="mt-4">
            <Suspense
              fallback={
                <div className="py-20 text-center text-sm text-zinc-500">Loading reputation data…</div>
              }
            >
              <ReputationAuditDashboard businessId={businessId} />
            </Suspense>
          </div>
        </details>
      ) : null}
    </div>
  );
}
