import { Shield } from "lucide-react";
import { loadLatestCitationAudit } from "@/lib/citations/engine";
import { DonutScore, OverviewCardShell, Sparkline } from "@/components/overview/overview-charts";

function sparkFromScore(score: number) {
  const base = score / 100;
  return [base * 0.6, base * 0.7, base * 0.65, base * 0.8, base * 0.75, base * 0.9, base].map(
    (v) => Math.round(v * 100)
  );
}

export async function CitationHealthOverviewCard({ businessId }: { businessId: string }) {
  const data = await loadLatestCitationAudit(businessId);

  if (!data?.audit) {
    return (
      <OverviewCardShell href={`/businesses/${businessId}/citations`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Shield className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Citation Health</p>
            <p className="mt-2 text-3xl font-bold text-text">—</p>
            <p className="mt-2 text-xs text-text-muted">Run citation audit</p>
          </div>
        </div>
      </OverviewCardShell>
    );
  }

  const { audit } = data;
  const score = audit.score != null ? Math.round(audit.score) : null;
  const sub = `${audit.found_count} found · ${audit.missing_count} missing · ${audit.nap_issue_count} NAP issues`;

  return (
    <OverviewCardShell href={`/businesses/${businessId}/citations`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Shield className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-text">Citation Health</p>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-text">
            {score != null ? `${score}/100` : "—"}
          </p>
          <p className="mt-2 text-xs text-text-muted">{sub}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {score != null && <Sparkline data={sparkFromScore(score)} color="#3b82f6" />}
        </div>
      </div>
    </OverviewCardShell>
  );
}
