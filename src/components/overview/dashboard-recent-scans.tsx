"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { DashboardScanRow } from "@/lib/overview/load-dashboard-scans";
import { cn } from "@/lib/utils";
import { isScanActivelyRunning } from "@/lib/scans/status";

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
    return null;
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
  rows: initialRows,
  total: initialTotal,
}: {
  businessId: string;
  rows: DashboardScanRow[];
  total: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    setRows(initialRows);
    setTotal(initialTotal);
  }, [initialRows, initialTotal]);

  const hasActive = rows.some(
    (scan) => scan.active || isScanActivelyRunning(scan.status)
  );

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/recent-scans?preview=3`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { rows?: DashboardScanRow[]; total?: number };
      if (Array.isArray(json.rows)) setRows(json.rows);
      if (typeof json.total === "number") setTotal(json.total);
    } catch {
      /* ignore transient poll errors */
    }
  }, [businessId]);

  // While any scan is active, poll every 5s so the spinner becomes a heatmap
  // without the user leaving or manually refreshing the dashboard.
  useEffect(() => {
    if (!hasActive) return;
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [hasActive, poll]);

  return (
    <section className="overflow-hidden rounded-xl border border-[#E6EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#F2F4F7] px-4 py-3.5">
        <div>
          <h2 className="text-base font-semibold text-[#101828]">Recent Maps Scans</h2>
          <p className="mt-0.5 text-xs text-[#667085]">{total} total scans</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void poll()} className="text-sm font-semibold text-[#667085] hover:text-[#137752]">
            Refresh
          </button>
          <Link href={`/businesses/${businessId}/scans`} className="text-sm font-semibold text-[#137752] hover:underline">
            Export
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[#667085]">
          No scans yet.{" "}
          <Link href={`/businesses/${businessId}/scans`} className="font-semibold text-[#137752] hover:underline">
            Run your first scan
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-[#F2F4F7] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                <th className="px-4 py-3 text-left">Date / Keyword</th>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Visibility</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F4F7]">
              {rows.map((scan) => {
                const active = scan.active || isScanActivelyRunning(scan.status);
                return (
                  <tr key={scan.id} className="transition-colors hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-[#101828]">
                        {formatScanDate(scan.createdAt || scan.finishedAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        {scan.keyword ?? "Historical scan"} · {scan.gridSize}×{scan.gridSize}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold tabular-nums text-[#101828]">
                      {active ? "—" : (scan.arp ?? "—")}
                      {!active ? <span className="ml-1"><ChangeCell value={scan.change} /></span> : null}
                    </td>
                    <td className="px-4 py-3.5 text-sm tabular-nums text-[#344054]">
                      {active ? "—" : scan.solv != null ? `${scan.solv}%` : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#175CD3]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Running
                        </span>
                      ) : scan.status === "failed" || scan.status === "cancelled" ? (
                        <span className="inline-flex rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[11px] font-semibold text-[#B42318]">
                          {scan.status}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#027A48]">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/businesses/${businessId}/grid/${scan.id}`}
                        className="text-sm font-semibold text-[#137752] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F4F7] px-4 py-3 text-xs text-[#667085]">
        <span className="tabular-nums">
          Showing {rows.length} of {total} scan{total === 1 ? "" : "s"}
        </span>
        <Link
          href={`/businesses/${businessId}/scans`}
          className="inline-flex items-center gap-1 font-semibold text-[#137752] hover:underline"
        >
          Full history
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
