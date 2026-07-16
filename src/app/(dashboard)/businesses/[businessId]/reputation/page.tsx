import { Suspense } from "react";
import { ReputationAuditDashboard } from "@/components/reputation/reputation-audit-dashboard";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

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
