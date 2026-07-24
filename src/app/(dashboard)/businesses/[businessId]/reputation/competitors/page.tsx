import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CompetitorIntelligenceDashboard } from "@/components/reviews/competitor-intelligence-dashboard";
import { loadCompetitorIntelligenceData } from "@/lib/reviews/competitor-intelligence-data";

async function CompetitorIntelligenceLoaded({ businessId }: { businessId: string }) {
  const data = await loadCompetitorIntelligenceData(businessId);
  return <CompetitorIntelligenceDashboard businessId={businessId} data={data} />;
}

export default async function ReputationCompetitorsPage({
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
      <CompetitorIntelligenceLoaded businessId={businessId} />
    </Suspense>
  );
}
