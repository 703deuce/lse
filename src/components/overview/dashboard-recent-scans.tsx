import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";
import { ScanMiniHeatmap } from "@/components/overview/scan-mini-heatmap";
import { cn } from "@/lib/utils";

function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ChangeCell({ value }: { value: number | null }) {
  if (value == null || value === 0) {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        "text-xs font-semibold tabular-nums",
        positive ? "text-emerald-600" : "text-red-600"
      )}
    >
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

export function DashboardRecentScans({
  businessId,
  rows,
  total,
}: {
  businessId: string;
  rows: DashboardScanRow[];
  total: number;
}) {
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Recent Maps Scans
        </h2>
        <Link
          href={`/businesses/${businessId}/scans`}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          View all scans →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-500">
          No scans yet.{" "}
          <Link href={`/businesses/${businessId}/scans`} className="font-medium text-emerald-600">
            Run your first scan →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-2.5 font-medium">Keyword</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Grid</th>
                <th className="px-3 py-2.5 font-medium">ARP</th>
                <th className="px-3 py-2.5 font-medium">SOLV / SAIV</th>
                <th className="px-3 py-2.5 font-medium">Change</th>
                <th className="px-3 py-2.5 font-medium">Heatmap</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((scan) => (
                <tr key={scan.id} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    {scan.keyword ?? "Unknown keyword"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-600">
                    {formatScanDate(scan.finishedAt)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-zinc-600">
                    {scan.gridSize}×{scan.gridSize}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-zinc-900">
                    {scan.arp ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-zinc-600">
                    {scan.solv != null ? `${scan.solv}%` : "—"}
                    {scan.saiv != null && (
                      <span className="text-zinc-400"> / {scan.saiv}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <ChangeCell value={scan.change} />
                  </td>
                  <td className="px-3 py-2.5">
                    <ScanMiniHeatmap ranks={scan.ranks} gridSize={scan.gridSize} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/businesses/${businessId}/grid/${scan.id}`}
                      className="inline-flex items-center rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Open Workspace
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-500">
        <span>
          Showing {rows.length} of {total} scan{total === 1 ? "" : "s"}
        </span>
        <Link
          href={`/businesses/${businessId}/scans`}
          className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700"
        >
          View full scan history
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
