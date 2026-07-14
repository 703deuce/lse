import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";
import { ScanMiniHeatmap } from "@/components/overview/scan-mini-heatmap";
import {
  dashboardAccentLink,
  dashboardCard,
  dashboardCardTitle,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { btnSecondary } from "@/components/ui/design-system";
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
    return <span className="text-[12px] tabular-nums text-zinc-400">—</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={cn(
        "text-[12px] font-semibold tabular-nums",
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
    <section className={cn(dashboardCard, "overflow-hidden p-0")}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5">
        <h2 className={dashboardCardTitle}>Recent Maps Scans</h2>
        <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
          View all
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-3.5 py-8 text-center text-[13px] text-zinc-500">
          No scans yet.{" "}
          <Link href={`/businesses/${businessId}/scans`} className={dashboardAccentLink}>
            Run your first scan
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60">
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Keyword</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Date</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Grid</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>ARP</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>SOLV / SAIV</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Change</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-left")}>Heatmap</th>
                <th className={cn(dashboardSectionLabel, "px-3.5 py-2 text-right")}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((scan) => (
                <tr key={scan.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-3.5 py-2 text-[13px] font-medium text-zinc-900">
                    {scan.keyword ?? "Unknown keyword"}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2 text-[12px] tabular-nums text-zinc-500">
                    {formatScanDate(scan.finishedAt)}
                  </td>
                  <td className="px-3.5 py-2 text-[12px] tabular-nums text-zinc-500">
                    {scan.gridSize}×{scan.gridSize}
                  </td>
                  <td className="px-3.5 py-2 text-[13px] font-semibold tabular-nums text-zinc-900">
                    {scan.arp ?? "—"}
                  </td>
                  <td className="px-3.5 py-2 text-[12px] tabular-nums text-zinc-600">
                    {scan.solv != null ? `${scan.solv}%` : "—"}
                    {scan.saiv != null && (
                      <span className="text-zinc-400"> / {scan.saiv}%</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2">
                    <ChangeCell value={scan.change} />
                  </td>
                  <td className="px-3.5 py-2">
                    <ScanMiniHeatmap ranks={scan.ranks} gridSize={scan.gridSize} />
                  </td>
                  <td className="px-3.5 py-2 text-right">
                    <Link
                      href={`/businesses/${businessId}/grid/${scan.id}`}
                      className={cn(btnSecondary, "h-7 px-2.5 text-[11px] font-medium")}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/40 px-3.5 py-2 text-[11px] text-zinc-500">
        <span className="tabular-nums">
          Showing {rows.length} of {total} scan{total === 1 ? "" : "s"}
        </span>
        <Link
          href={`/businesses/${businessId}/scans`}
          className={cn(dashboardAccentLink, "inline-flex items-center gap-1")}
        >
          Full history
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
