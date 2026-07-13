"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Download, Link2, Loader2, Search, Trophy } from "lucide-react";
import { boolCell, powerBarsVertical } from "@/components/backlink-gap/backlink-gap-ui";
import { dashboardCard, dashboardCardTitle, dashboardControl, dashboardMicro, dashboardSectionLabel } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

const MATRIX_PAGE_SIZES = [10, 25, 50, 100] as const;
const DIST_COLORS = ["#16A34A", "#3b82f6", "#f59e0b", "#94a3b8"];

type MatrixRow = Record<string, boolean | string | number | null>;

type Distribution = {
  total: number;
  sharedByAll: number;
  sharedBySome: number;
  exclusive: number;
  onlyToYou: number;
};

const DIST_LABELS = [
  { key: "total" as const, label: "All Linking Domains", color: "#16A34A" },
  { key: "sharedByAll" as const, label: "Shared by All", color: "#16A34A" },
  { key: "sharedBySome" as const, label: "Shared by Some", color: "#3b82f6" },
  { key: "exclusive" as const, label: "Exclusive to Competitors", color: "#f59e0b" },
  { key: "onlyToYou" as const, label: "Only to You", color: "#94a3b8" },
];

export function BacklinkGapMatrixTab({
  businessId,
  competitors,
  targetDomain,
}: {
  businessId: string;
  competitors: Array<{ name: string; domain?: string | null }>;
  targetDomain?: string;
}) {
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [topCompetitor, setTopCompetitor] = useState<{
    name: string;
    domain?: string | null;
    count: number;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/backlink-gap/${businessId}/stats`)
      .then((r) => r.json())
      .then((json) => {
        setDistribution(json.matrixDistribution ?? null);
        setTopCompetitor(json.topCompetitor ?? null);
      })
      .catch(() => {
        setDistribution(null);
        setTopCompetitor(null);
      });
  }, [businessId]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/backlink-gap/${businessId}/matrix?page=${page}&pageSize=${pageSize}`)
      .then((r) => r.json())
      .then((json) => {
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [businessId, page, pageSize]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => String(r.domain).toLowerCase().includes(q));
  }, [rows, search]);

  const distTotal = distribution?.total ?? total;
  const distData = distribution
    ? [
        { name: "Shared by All", value: distribution.sharedByAll },
        { name: "Shared by Some", value: distribution.sharedBySome },
        { name: "Exclusive to Competitors", value: distribution.exclusive },
        { name: "Only to You", value: distribution.onlyToYou },
      ].filter((d) => d.value > 0)
    : [];

  const topCompetitorPct =
    topCompetitor && distTotal > 0 ? Math.round((topCompetitor.count / distTotal) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className={cn(dashboardCard, "p-3.5")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Link2 className="h-4 w-4" />
          </span>
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {DIST_LABELS.map((item, idx) => {
              const value =
                item.key === "total" ? distTotal : distribution ? distribution[item.key] : 0;
              const pct =
                distTotal > 0 && item.key !== "total" ? Math.round((value / distTotal) * 100) : null;
              return (
                <div key={item.label}>
                  <div className="flex items-center gap-1.5">
                    {item.key !== "total" && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: DIST_COLORS[idx - 1] ?? item.color }}
                      />
                    )}
                    <p className={dashboardSectionLabel}>{item.label}</p>
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900">{value}</p>
                  {pct != null && <p className={dashboardMicro}>{pct}%</p>}
                  {item.key === "total" && distTotal > 0 && (
                    <p className={dashboardMicro}>100% of total</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="relative mx-auto h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58}>
                  {distData.map((_, idx) => (
                    <Cell key={idx} fill={DIST_COLORS[idx % DIST_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-base font-bold text-zinc-900">{distTotal}</p>
              <p className="text-[10px] text-zinc-500">Total</p>
            </div>
          </div>
          <div className="w-full shrink-0 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 xl:w-[200px]">
            <div className="flex items-center gap-2 text-emerald-700">
              <Trophy className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold">Top Competitor with Most Links</p>
            </div>
            {topCompetitor ? (
              <div className="mt-2">
                <p className="text-[13px] font-semibold text-zinc-900">
                  {topCompetitor.domain?.replace(/^www\./, "") ?? topCompetitor.name}
                </p>
                <p className={`mt-0.5 ${dashboardMicro}`}>
                  {topCompetitor.count} domains ({topCompetitorPct}%)
                </p>
              </div>
            ) : (
              <p className={`mt-2 ${dashboardMicro}`}>No competitor data.</p>
            )}
          </div>
        </div>
      </div>

      <div className={cn(dashboardCard, "flex flex-wrap items-center gap-2 p-2.5")}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className={cn(dashboardControl, "w-full py-0 pl-8 pr-3 text-[13px]")}
          />
        </div>
        <select className={cn(dashboardControl, "px-3 text-[13px]")}>
          <option>Link Type: All</option>
        </select>
        <select className={cn(dashboardControl, "px-3 text-[13px]")}>
          <option>Link Power: All</option>
        </select>
        <select className={cn(dashboardControl, "px-3 text-[13px]")}>
          <option>Domain Authority: All</option>
        </select>
        <button
          type="button"
          className="text-[11px] font-medium text-zinc-500 hover:text-zinc-700"
        >
          + More Filters
        </button>
        <button
          type="button"
          className={cn(dashboardControl, "ml-auto inline-flex items-center gap-1.5 px-3 font-medium")}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className={cn(dashboardCard, "overflow-hidden p-0")}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3.5 py-2.5">
          <p className={dashboardCardTitle}>{total} linking domains in matrix</p>
          <div className={`flex items-center gap-2 ${dashboardMicro}`}>
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-zinc-200 px-2 py-0.5 text-[12px]"
            >
              {MATRIX_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              {from}–{to} of {total}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-500">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            <span className="text-[13px]">Loading matrix…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="bg-zinc-50 text-left">
                <tr>
                  <th className={cn(dashboardSectionLabel, "w-10 px-3 py-2")}>
                    <input type="checkbox" className="rounded border-zinc-300" aria-label="Select all" />
                  </th>
                  <th className={cn(dashboardSectionLabel, "px-3 py-2")}>Linking Domain (DA)</th>
                  <th className={cn(dashboardSectionLabel, "px-3 py-2")}>Link Power</th>
                  <th className={cn(dashboardSectionLabel, "px-3 py-2 text-center")}>
                    <div>You</div>
                    {targetDomain && (
                      <div className="mt-0.5 text-[10px] font-normal normal-case text-zinc-400">
                        {targetDomain.replace(/^www\./, "")}
                      </div>
                    )}
                  </th>
                  {competitors.map((c) => (
                    <th key={c.name} className={cn(dashboardSectionLabel, "px-3 py-2 text-center")}>
                      {c.domain?.replace(/^www\./, "") ?? c.name.split(" ")[0]}
                    </th>
                  ))}
                  <th className={cn(dashboardSectionLabel, "px-3 py-2 text-center")}>Domains Linking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredRows.map((row) => {
                  const power =
                    row.authority_score != null ? Math.round(Number(row.authority_score)) : null;
                  const linked = Number(row.competitor_count ?? 0);
                  return (
                    <tr key={String(row.domain)} className="hover:bg-zinc-50">
                      <td className="px-3 py-2">
                        <input type="checkbox" className="rounded border-zinc-300" aria-label={`Select ${row.domain}`} />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-sky-700">{String(row.domain)}</p>
                        <p className={dashboardMicro}>
                          DA {row.domain_rank != null ? Math.round(Number(row.domain_rank)) : "—"} ·{" "}
                          {String(row.source_type ?? "Unknown")}
                        </p>
                      </td>
                      <td className="px-3 py-2">{powerBarsVertical(power)}</td>
                      <td className="px-3 py-2 text-center">{boolCell(!!row.you)}</td>
                      {competitors.map((c) => (
                        <td key={c.name} className="px-3 py-2 text-center">
                          {boolCell(!!row[c.name])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center text-[12px] font-medium text-zinc-600">
                        {linked}/{competitors.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="flex justify-end gap-2 border-t border-zinc-100 px-3.5 py-2.5 text-[13px]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-zinc-200 px-2.5 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 py-1 text-zinc-500">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-zinc-200 px-2.5 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
