import { Suspense } from "react";
import { ReputationAuditDashboard } from "@/components/reputation/reputation-audit-dashboard";

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-zinc-500">Loading reputation data…</div>
      }
    >
      <ReputationAuditDashboard businessId={businessId} />
    </Suspense>
  );
}
