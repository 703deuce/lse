import { BusinessModuleShell } from "@/components/dashboard/business-module-shell";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  return (
    <BusinessModuleShell
      businessId={businessId}
      title="Monthly Progress Report"
      subtitle="Track scan trends, task completion, and visibility changes over time"
    >
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-zinc-500">
          Monthly reports will aggregate rank grid trends, completed action items, and audit score improvements.
        </p>
        <p className="mt-2 text-sm text-zinc-400">Use Weekly Action Plan and Rank Grid scans in the meantime.</p>
      </div>
    </BusinessModuleShell>
  );
}
