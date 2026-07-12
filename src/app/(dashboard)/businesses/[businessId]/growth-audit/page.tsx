import { Suspense } from "react";
import { GrowthAuditDashboard } from "@/components/growth-audit/growth-audit-dashboard";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";

export default async function GrowthAuditPage({
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
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <GrowthAuditDashboard businessId={businessId} />
    </Suspense>
  );
}
