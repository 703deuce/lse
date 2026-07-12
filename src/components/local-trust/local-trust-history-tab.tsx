"use client";

import { RefreshCw } from "lucide-react";

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
      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-10 text-center shadow-sm">
        <p className="text-sm text-zinc-500">No search history yet. Run your first market scan to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">Search History</h3>
          <p className="text-xs text-zinc-500">Each market scan is saved separately — results are never overwritten.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Market</th>
                <th className="px-4 py-2.5 text-right">Accepted</th>
                <th className="px-4 py-2.5 text-right">Rejected</th>
                <th className="px-4 py-2.5">Last scanned</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {markets.map((m) => (
                <tr key={`${m.city}-${m.state}`} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {m.city}, {m.state}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{m.acceptedCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{m.rejectedCount}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(m.latestRunAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-emerald-700 hover:underline"
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
                        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
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
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900">Recent rescan summaries</h3>
          <div className="mt-3 space-y-3">
            {runs
              .filter((r) => r.scan_type === "rescan" && r.rescan_summary_json)
              .slice(0, 5)
              .map((r) => {
                const s = r.rescan_summary_json as Record<string, number>;
                return (
                  <div key={r.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm">
                    <p className="font-medium text-zinc-800">
                      {r.city}, {r.state} — {formatDate(r.finished_at ?? r.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
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
