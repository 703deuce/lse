"use client";

import { RefreshCw } from "lucide-react";
import { dashboardCard, dashboardCardTitle, dashboardMicro } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export type RunHistoryRow = {
  id: string;
  city: string | null;
  state: string | null;
  county: string | null;
  status: string;
  scan_type: string;
  opportunities_found: number;
  filtered_out_count: number | null;
  created_at: string;
  finished_at: string | null;
  rescan_summary_json: Record<string, unknown> | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LocalTrustHistoryTab({
  runs,
  markets,
  onViewRun,
  onRescan,
  isRunning,
}: {
  runs: RunHistoryRow[];
  markets: Array<{ city: string; state: string; acceptedCount: number; rejectedCount: number; latestRunAt: string | null }>;
  onViewRun: (run: RunHistoryRow) => void;
  onRescan: (city: string, state: string) => void;
  isRunning: boolean;
}) {
  if (!markets.length && !runs.length) {
    return (
      <div className={cn(dashboardCard, "px-3.5 py-8 text-center")}>
        <p className="text-[13px] text-zinc-500">No search history yet. Run your first market scan to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={cn(dashboardCard, "overflow-hidden")}>
        <div className="border-b border-zinc-100 px-3.5 py-2.5">
          <h3 className={dashboardCardTitle}>Search History</h3>
          <p className={dashboardMicro}>Each market scan is saved separately — results are never overwritten.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3.5 py-2">Market</th>
                <th className="px-3.5 py-2 text-right">Accepted</th>
                <th className="px-3.5 py-2 text-right">Rejected</th>
                <th className="px-3.5 py-2">Last scanned</th>
                <th className="px-3.5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {markets.map((m) => (
                <tr key={`${m.city}-${m.state}`} className="hover:bg-zinc-50/80">
                  <td className="px-3.5 py-2 font-medium text-zinc-900">
                    {m.city}, {m.state}
                  </td>
                  <td className="px-3.5 py-2 text-right tabular-nums text-emerald-700">{m.acceptedCount}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums text-zinc-500">{m.rejectedCount}</td>
                  <td className="px-3.5 py-2 text-zinc-500">{formatDate(m.latestRunAt)}</td>
                  <td className="px-3.5 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-emerald-700 hover:underline"
                        onClick={() =>
                          onViewRun({
                            id: "",
                            city: m.city,
                            state: m.state,
                            county: null,
                            status: "complete",
                            scan_type: "initial",
                            opportunities_found: m.acceptedCount,
                            filtered_out_count: m.rejectedCount,
                            created_at: m.latestRunAt ?? "",
                            finished_at: m.latestRunAt,
                            rescan_summary_json: null,
                          })
                        }
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
                        onClick={() => onRescan(m.city, m.state)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Re-run
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {runs.some((r) => r.scan_type === "rescan" && r.rescan_summary_json) && (
        <div className={cn(dashboardCard, "p-3.5")}>
          <h3 className={dashboardCardTitle}>Recent rescan summaries</h3>
          <div className="mt-2.5 space-y-2">
            {runs
              .filter((r) => r.scan_type === "rescan" && r.rescan_summary_json)
              .slice(0, 5)
              .map((r) => {
                const s = r.rescan_summary_json as Record<string, number>;
                return (
                  <div key={r.id} className="rounded-md border border-zinc-100 bg-zinc-50/50 px-3.5 py-2 text-[13px]">
                    <p className="font-medium text-zinc-800">
                      {r.city}, {r.state} — {formatDate(r.finished_at ?? r.created_at)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {s.candidatesFound ?? 0} candidates · {s.alreadyKnown ?? 0} already known ·{" "}
                      {s.newOpportunitiesAdded ?? 0} new opportunities · {s.marketTotalAccepted ?? 0} total in market
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
