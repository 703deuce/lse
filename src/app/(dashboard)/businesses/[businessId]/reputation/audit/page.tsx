import { Suspense } from "react";
import { ReputationAuditDashboard } from "@/components/reputation/reputation-audit-dashboard";
import { ReputationStrategyReport } from "@/components/reputation/reputation-modules-audit-dashboard";
import { loadReputationModulesAudit } from "@/lib/reputation/reputation-modules-audit";

export default async function ReputationAuditPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const data = await loadReputationModulesAudit(businessId);

  return (
    <div className="space-y-6">
      <ReputationStrategyReport businessId={businessId} data={data} />
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
    </div>
  );
}
