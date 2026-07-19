import { BusinessModuleShell } from "@/components/dashboard/business-module-shell";
import { emptyStateClass } from "@/components/ui/design-system";

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <BusinessModuleShell
      businessId={businessId}
      title="Monthly Progress Report"
      subtitle="Track scan trends, task completion, and visibility changes over time"
    >
      <div className={emptyStateClass}>
        <p className="text-zinc-500">
          Monthly reports will aggregate rank grid trends, completed action items, and audit score improvements.
        </p>
        <p className="mt-2 text-sm text-zinc-400">Use Weekly Action Plan and Rank Grid scans in the meantime.</p>
      </div>
    </BusinessModuleShell>
  );
}
