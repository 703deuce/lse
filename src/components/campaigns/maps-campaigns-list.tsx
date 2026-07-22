"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChartNoAxesColumn,
  Grid2X2,
  LayoutGrid,
  List,
  MapPin,
  MoreVertical,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import { mock } from "@/components/mockup/ui";
import { Sparkline } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";
import type {
  CampaignListBusiness,
  CampaignListRow,
  CampaignListStats,
} from "@/lib/campaigns/campaign-list-summaries";

type StatusFilter = "all" | "active" | "paused" | "draft";
type SortId = "newest" | "name" | "keywords" | "avg";

function fmtPosDisplay(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(3);
}

function ChangePill({ value }: { value: number | null }) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return <span className="text-[12px] font-medium text-[#98A2B3]">—</span>;
  }
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[12px] font-semibold",
        up ? "text-[#027A48]" : "text-[#B42318]"
      )}
    >
      {up ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}

function StatusDot({ status }: { status: CampaignListRow["status"] }) {
  const label =
    status === "active" ? "Active" : status === "paused" ? "Paused" : "Draft";
  const color =
    status === "active"
      ? "bg-[#12B76A]"
      : status === "paused"
        ? "bg-[#F79009]"
        : "bg-[#98A2B3]";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#344054]">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  iconClass,
  spark,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  spark: number[];
}) {
  return (
    <div className={cn(mock.card, "flex items-start justify-between gap-3 p-4")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              iconClass
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              {label}
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-[#101828]">
              {value}
            </p>
          </div>
        </div>
      </div>
      <Sparkline data={spark} color="#12B76A" width={72} height={28} className="mt-1 opacity-90" />
    </div>
  );
}

function sparkFromValue(n: number, seed: number): number[] {
  const base = Math.max(1, Math.abs(n));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const wave = Math.sin((i + seed) * 0.9) * 0.18 + 0.82;
    return Math.max(0.2, base * wave * (0.7 + i * 0.05));
  });
}

function hostFromUrl(url: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

export function MapsCampaignsList({
  businessId,
  campaigns,
  business,
  stats,
  onNewCampaign,
}: {
  businessId: string;
  campaigns: CampaignListRow[];
  business: CampaignListBusiness | null;
  stats: CampaignListStats;
  onNewCampaign: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortId>("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = campaigns.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "keywords") return b.keywordCount - a.keywordCount;
      if (sort === "avg") {
        const av = a.avgPosition ?? 999;
        const bv = b.avgPosition ?? 999;
        return av - bv;
      }
      const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bt - at;
    });
    return rows;
  }, [campaigns, query, statusFilter, sort]);

  const websiteHost = hostFromUrl(business?.websiteUrl ?? null);
  const locationLabel = business?.locationLabel ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={mock.title}>Maps Campaigns</h1>
          <p className={mock.subtitle}>
            Group keywords, establish a baseline, and run recurring Maps scans for this
            location.
          </p>
        </div>
        <button type="button" onClick={onNewCampaign} className={cn(mock.btnPrimary, "shrink-0")}>
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Keywords"
          value={String(stats.totalKeywords)}
          icon={Grid2X2}
          iconClass="bg-[#ECFDF3] text-[#027A48]"
          spark={sparkFromValue(stats.totalKeywords || 1, 1)}
        />
        <KpiCard
          label="Active campaigns"
          value={String(stats.activeCampaigns)}
          icon={MapPin}
          iconClass="bg-[#F0F9FF] text-[#026AA2]"
          spark={sparkFromValue(stats.activeCampaigns || 1, 2)}
        />
        <KpiCard
          label="Rankings up"
          value={String(stats.rankingsUp)}
          icon={TrendingUp}
          iconClass="bg-[#ECFDF3] text-[#027A48]"
          spark={sparkFromValue(stats.rankingsUp || 1, 3)}
        />
        <KpiCard
          label="Avg. Rank Position"
          value={
            stats.avgRankPosition != null ? fmtPosDisplay(stats.avgRankPosition) : "—"
          }
          icon={ChartNoAxesColumn}
          iconClass="bg-[#F4F3FF] text-[#5925DC]"
          spark={sparkFromValue(stats.avgRankPosition ?? 8, 4)}
        />
      </div>

      <section className={cn(mock.card, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-[#F2F4F7] px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns"
              className="h-10 w-full rounded-lg border border-[#E6EAF0] bg-white pl-9 pr-3 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                statusFilter === "all"
                  ? "bg-[#137752] text-white"
                  : "border border-[#E6EAF0] bg-white text-[#475467] hover:bg-[#F9FAFB]"
              )}
            >
              All
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475467]">
              Status
              <select
                value={statusFilter === "all" ? "" : statusFilter}
                onChange={(e) =>
                  setStatusFilter((e.target.value || "all") as StatusFilter)
                }
                className="bg-transparent text-[#344054] outline-none"
              >
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#98A2B3]">
              Budget
              <select disabled className="bg-transparent outline-none" aria-label="Budget">
                <option>Any</option>
              </select>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#98A2B3]">
              Staff
              <select disabled className="bg-transparent outline-none" aria-label="Staff">
                <option>Any</option>
              </select>
            </span>
            <label className="inline-flex items-center gap-1.5 rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475467]">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="bg-transparent text-[#344054] outline-none"
              >
                <option value="newest">Newest</option>
                <option value="name">Name</option>
                <option value="keywords">Keywords</option>
                <option value="avg">Avg. position</option>
              </select>
            </label>
            <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-[#E6EAF0]">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "px-2.5 py-1.5",
                  view === "list" ? "bg-[#F2F4F7] text-[#101828]" : "bg-white text-[#98A2B3]"
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "px-2.5 py-1.5",
                  view === "grid" ? "bg-[#F2F4F7] text-[#101828]" : "bg-white text-[#98A2B3]"
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {!filtered.length ? (
          <p className="px-4 py-12 text-center text-sm text-[#667085]">
            No campaigns match this filter.
          </p>
        ) : view === "grid" ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="rounded-xl border border-[#E6EAF0] bg-white p-4 transition hover:border-[#137752]/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[14px] font-semibold text-[#101828]">{c.name}</p>
                  <StatusDot status={c.status} />
                </div>
                <p className="mt-2 text-[12px] text-[#667085]">
                  {c.keywordCount} keywords · Avg {fmtPosDisplay(c.avgPosition)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className={mock.tableHead}>
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Keywords</th>
                  <th className="px-4 py-3 font-semibold">Avg. Pos</th>
                  <th className="px-4 py-3 font-semibold">Map</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F9FAFB]/80">
                    <td className="px-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#027A48]">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="block truncate text-[14px] font-semibold text-[#101828] hover:text-[#137752]"
                          >
                            {c.name}
                          </Link>
                          <p className="mt-0.5 truncate text-[12px] text-[#667085]">
                            {websiteHost ? (
                              <span className="text-[#475467]">{websiteHost}</span>
                            ) : (
                              <span className="capitalize">{c.schedule_type} schedule</span>
                            )}
                            {business?.name ? (
                              <span className="text-[#98A2B3]"> · {business.name}</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
                        Status
                      </p>
                      <StatusDot status={c.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-[#98A2B3]">
                        Keywords
                      </p>
                      <p className="text-[14px] font-semibold text-[#101828]">{c.keywordCount}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[14px] font-semibold text-[#101828]">
                        {fmtPosDisplay(c.avgPosition)}
                      </p>
                      <ChangePill value={c.avgPositionChange} />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[14px] font-semibold text-[#101828]">
                        {fmtPosDisplay(c.mapPosition)}
                      </p>
                      <ChangePill value={c.mapPositionChange} />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-[#344054]">{locationLabel}</p>
                    </td>
                    <td className="relative px-4 py-3.5 text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
                        aria-label="Campaign actions"
                        onClick={() =>
                          setMenuOpen((id) => (id === c.id ? null : c.id))
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpen === c.id ? (
                        <div className="absolute right-4 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-[#E6EAF0] bg-white py-1 shadow-lg">
                          <Link
                            href={`/campaigns/${c.id}`}
                            className="block px-3 py-2 text-left text-[13px] font-medium text-[#344054] hover:bg-[#F9FAFB]"
                            onClick={() => setMenuOpen(null)}
                          >
                            Open campaign
                          </Link>
                          <Link
                            href={`/businesses/${businessId}/scans`}
                            className="block px-3 py-2 text-left text-[13px] font-medium text-[#344054] hover:bg-[#F9FAFB]"
                            onClick={() => setMenuOpen(null)}
                          >
                            View scans
                          </Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#027A48]">Need more campaigns?</p>
          <p className="mt-0.5 text-sm text-[#027A48]/90">
            Target more keywords or locations for better visibility across the Maps and
            Search.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <button type="button" onClick={onNewCampaign} className={mock.btnPrimary}>
            <Plus className="h-4 w-4" />
            Add Campaign
          </button>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#137752] hover:underline"
          >
            See how it works
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
