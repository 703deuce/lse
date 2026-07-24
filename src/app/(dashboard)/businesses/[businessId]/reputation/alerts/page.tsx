import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReputationAlertsDashboard } from "@/components/reputation/reputation-alerts-dashboard";
import { loadReputationAlertsData } from "@/lib/reputation/alerts-data";

async function ReputationAlertsLoaded({ businessId }: { businessId: string }) {
  const data = await loadReputationAlertsData(businessId);
  return <ReputationAlertsDashboard businessId={businessId} data={data} />;
}

export default async function ReputationAlertsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ReputationAlertsLoaded businessId={businessId} />
    </Suspense>
  );
}
