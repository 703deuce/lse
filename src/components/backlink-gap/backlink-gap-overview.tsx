import { Link2 } from "lucide-react";
import { loadLatestBacklinkGapRun } from "@/lib/backlink-gap/engine";
import { OverviewCardShell, Sparkline } from "@/components/overview/overview-charts";

function sparkFromCount(count: number) {
  const max = Math.max(count, 100);
  return [0.3, 0.45, 0.4, 0.55, 0.5, 0.65, 0.7].map((v) => Math.round(v * max));
}

export async function BacklinkGapOverviewCard({ businessId }: { businessId: string }) {
  const data = await loadLatestBacklinkGapRun(businessId);

  if (!data?.run || data.run.status === "failed") {
    return (
      <OverviewCardShell href={`/businesses/${businessId}/backlink-gap`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Link2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Backlink Gap</p>
            <p className="mt-2 text-3xl font-bold text-text">—</p>
            <p className="mt-2 text-xs text-text-muted">Run competitor backlink analysis</p>
          </div>
        </div>
      </OverviewCardShell>
    );
  }

  const { run } = data;
  const count = run.missing_opportunity_count ?? 0;
  const sub = `${count} competitor link opportunities · ${run.high_priority_count ?? 0} high priority`;

  return (
    <OverviewCardShell href={`/businesses/${businessId}/backlink-gap`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Link2 className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-text">Backlink Gap</p>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-text">{count}</p>
          <p className="mt-2 text-xs text-text-muted">{sub}</p>
        </div>
        <Sparkline data={sparkFromCount(count)} color="#f97316" width={72} height={28} />
      </div>
    </OverviewCardShell>
  );
}
