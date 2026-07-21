"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Download, Link2, Loader2, Search, Trophy } from "lucide-react";
import { boolCell, gapControl, powerBarsVertical } from "@/components/backlink-gap/backlink-gap-ui";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

const MATRIX_PAGE_SIZES = [10, 25, 50, 100] as const;
const DIST_COLORS = ["#137752", "#1570EF", "#F79009", "#7A5AF8"];

type MatrixRow = Record<string, boolean | string | number | null>;

type Distribution = {
  total: number;
  sharedByAll: number;
  sharedBySome: number;
  exclusive: number;
  onlyToYou: number;
};

const DIST_LABELS = [
  { key: "total" as const, label: "All Linking Domains", color: "#137752" },
  { key: "sharedByAll" as const, label: "Shared by All", color: "#137752" },
  { key: "sharedBySome" as const, label: "Shared by Some", color: "#1570EF" },
  { key: "exclusive" as const, label: "Exclusive to Competitors", color: "#F79009" },
  { key: "onlyToYou" as const, label: "Only to You", color: "#7A5AF8" },
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
      <div className={cn(mock.card, "p-4")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#137752]">
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
                    <p className={mock.label}>{item.label}</p>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#101828]">{value}</p>
                  {pct != null && <p className="text-[12px] text-[#667085]">{pct}%</p>}
                  {item.key === "total" && distTotal > 0 && (
                    <p className="text-[12px] text-[#667085]">100% of total</p>
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
              <p className="text-base font-bold text-[#101828]">{distTotal}</p>
              <p className="text-[10px] text-[#667085]">Total</p>
            </div>
          </div>
          <div className="w-full shrink-0 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] p-3.5 xl:w-[210px]">
            <div className="flex items-center gap-2 text-[#027A48]">
              <Trophy className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold">Top Competitor with Most Links</p>
            </div>
            {topCompetitor ? (
              <div className="mt-2">
                <p className="text-sm font-semibold text-[#101828]">
                  {topCompetitor.domain?.replace(/^www\./, "") ?? topCompetitor.name}
                </p>
                <p className="mt-0.5 text-[12px] text-[#027A48]">
                  {topCompetitor.count} domains ({topCompetitorPct}%)
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-[#667085]">No competitor data.</p>
            )}
          </div>
        </div>
      </div>

      <div className={cn(mock.card, "flex flex-wrap items-center gap-2 p-3")}>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A2B3]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domains..."
            className={cn(gapControl, "w-full py-0 pl-8 pr-3")}
          />
        </div>
        <select className={gapControl}>
          <option>Link Type: All</option>
        </select>
        <select className={gapControl}>
          <option>Link Power: All</option>
        </select>
        <select className={gapControl}>
          <option>Domain Authority: All</option>
        </select>
        <button type="button" className="text-[12px] font-semibold text-[#667085] hover:text-[#344054]">
          + More Filters
        </button>
        <button type="button" className={cn(mock.btnSecondary, "ml-auto h-9")}>
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className={cn(mock.card, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2F4F7] px-4 py-3">
          <p className="text-sm font-semibold text-[#101828]">{total} linking domains in matrix</p>
          <div className="flex items-center gap-2 text-[12px] text-[#667085]">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className={gapControl}
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
          <div className="flex items-center justify-center py-10 text-[#667085]">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            <span className="text-sm">Loading matrix…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={mock.tableHead}>
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" className="rounded border-[#D0D5DD]" aria-label="Select all" />
                  </th>
                  <th className="px-4 py-2.5">Linking Domain (DA)</th>
                  <th className="px-4 py-2.5">Link Power</th>
                  <th className="px-4 py-2.5 text-center">
                    <div>You</div>
                    {targetDomain && (
                      <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-[#98A2B3]">
                        {targetDomain.replace(/^www\./, "")}
                      </div>
                    )}
                  </th>
                  {competitors.map((c) => (
                    <th key={c.name} className="px-4 py-2.5 text-center">
                      {c.domain?.replace(/^www\./, "") ?? c.name.split(" ")[0]}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-center">Domains Linking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {filteredRows.map((row) => {
                  const power =
                    row.authority_score != null ? Math.round(Number(row.authority_score)) : null;
                  const linked = Number(row.competitor_count ?? 0);
                  return (
                    <tr key={String(row.domain)} className="hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-[#D0D5DD]"
                          aria-label={`Select ${row.domain}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1570EF]">{String(row.domain)}</p>
                        <p className="text-[12px] text-[#667085]">
                          DA {row.domain_rank != null ? Math.round(Number(row.domain_rank)) : "—"} ·{" "}
                          {String(row.source_type ?? "Unknown")}
                        </p>
                      </td>
                      <td className="px-4 py-3">{powerBarsVertical(power)}</td>
                      <td className="px-4 py-3 text-center">{boolCell(!!row.you)}</td>
                      {competitors.map((c) => (
                        <td key={c.name} className="px-4 py-3 text-center">
                          {boolCell(!!row[c.name])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center text-[12px] font-semibold text-[#475467]">
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
          <div className="flex justify-end gap-2 border-t border-[#F2F4F7] px-4 py-3 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={cn(mock.btnSecondary, "h-8 disabled:opacity-40")}
            >
              Prev
            </button>
            <span className="px-2 py-1.5 text-[#667085]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={cn(mock.btnSecondary, "h-8 disabled:opacity-40")}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
