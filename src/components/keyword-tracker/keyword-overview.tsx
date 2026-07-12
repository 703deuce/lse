import { Search } from "lucide-react";
import { loadKeywordTrackerData } from "@/lib/keyword-tracker/engine";
import { OverviewCardShell, MiniBarChart } from "@/components/overview/overview-charts";

export async function KeywordVisibilityOverviewCard({ businessId }: { businessId: string }) {
  const data = await loadKeywordTrackerData(businessId);
  const summary = data.summary;

  if (!summary || summary.tracked_count === 0) {
    return (
      <OverviewCardShell href={`/businesses/${businessId}/keywords`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Search className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Keyword Visibility</p>
            <p className="mt-2 text-3xl font-bold text-text">—</p>
            <p className="mt-2 text-xs text-text-muted">Track Maps rankings for local keywords</p>
          </div>
        </div>
      </OverviewCardShell>
    );
  }

  const barData = data.keywords
    .slice(0, 6)
    .map((k) => (k.latest_check?.rank != null ? Math.max(0, 21 - k.latest_check.rank) : 0));

  const sub = `${summary.tracked_count} keywords tracked · ${summary.top3_count} in top 3`;

  return (
    <OverviewCardShell href={`/businesses/${businessId}/keywords`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <Search className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-text">Keyword Visibility</p>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-text">
            {summary.avg_rank != null ? summary.avg_rank : "—"}
          </p>
          <p className="mt-2 text-xs text-text-muted">{sub}</p>
        </div>
        <MiniBarChart data={barData.length ? barData : [0]} color="#0ea5e9" width={64} height={32} />
      </div>
    </OverviewCardShell>
  );
}
