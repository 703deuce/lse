import { loadLatestGrowthAudit } from "@/lib/growth-audit/engine";
import { DonutScore, OverviewCardShell } from "@/components/overview/overview-charts";

export async function GrowthAuditOverviewCard({ businessId }: { businessId: string }) {
  const run = await loadLatestGrowthAudit(businessId);
  const score = run?.growth_score != null ? Math.round(run.growth_score) : null;

  return (
    <OverviewCardShell href={`/businesses/${businessId}/growth-audit`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text">Google Maps Growth Audit</p>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-text">
            {score != null ? `${score}/100` : "—"}
          </p>
          {run?.started_at && (
            <p className="mt-2 text-[11px] text-text-muted">
              Last run:{" "}
              {new Date(run.started_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        {score != null && <DonutScore score={score} size={80} strokeWidth={8} />}
      </div>
    </OverviewCardShell>
  );
}
