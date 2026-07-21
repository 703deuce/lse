"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  FolderKanban,
  MapPinned,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { mock, MockMetricCard } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

export type HubLocation = {
  id: string;
  name: string;
  accountType: string | null;
  isTracked: boolean | null;
  address: string | null;
  campaignCount: number;
  keywordCount: number;
  activeCampaignCount: number;
  pausedCampaignCount: number;
  archivedCampaignCount: number;
  latestCampaignName: string | null;
  latestCampaignId: string | null;
  latestUpdatedAt: string | null;
  status: "draft" | "active" | "paused" | "archived";
};

type FilterId = "all" | "drafts" | "paused" | "active" | "archived" | "ended";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "drafts", label: "Drafts" },
  { id: "paused", label: "Paused" },
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "ended", label: "Ended" },
];

const PAGE_SIZE = 8;

function statusBadge(status: HubLocation["status"]) {
  if (status === "active") return mock.badgeGreen;
  if (status === "paused") return mock.badgeAmber;
  if (status === "archived" || status === "draft") {
    return "inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]";
  }
  return mock.badgeGreen;
}

function statusLabel(status: HubLocation["status"]) {
  if (status === "draft") return "Draft";
  if (status === "paused") return "Paused";
  if (status === "archived") return "Archived";
  return "Active";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MapsCampaignsLocationHub({
  locations,
  totalCampaigns,
  completedRuns,
  mapCreditsRemaining,
  mapCreditsLimit,
}: {
  locations: HubLocation[];
  totalCampaigns: number;
  completedRuns: number;
  mapCreditsRemaining: number | null;
  mapCreditsLimit: number | null;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = locations.filter((loc) => {
      if (q && !loc.name.toLowerCase().includes(q) && !(loc.address ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (filter === "all") return true;
      if (filter === "drafts") return loc.status === "draft";
      if (filter === "paused") return loc.status === "paused";
      if (filter === "active") return loc.status === "active";
      if (filter === "archived" || filter === "ended") return loc.status === "archived";
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const at = a.latestUpdatedAt ? new Date(a.latestUpdatedAt).getTime() : 0;
      const bt = b.latestUpdatedAt ? new Date(b.latestUpdatedAt).getTime() : 0;
      return bt - at || a.name.localeCompare(b.name);
    });
    return rows;
  }, [locations, filter, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  const activeLocations = locations.filter((l) => l.status === "active" || l.campaignCount > 0).length;
  const firstLocation = locations[0];
  const createHref = firstLocation
    ? `/businesses/${firstLocation.id}/campaigns`
    : "/businesses/new?as=client";

  const recentActivity = [...locations]
    .filter((l) => l.latestUpdatedAt)
    .sort((a, b) => {
      const at = a.latestUpdatedAt ? new Date(a.latestUpdatedAt).getTime() : 0;
      const bt = b.latestUpdatedAt ? new Date(b.latestUpdatedAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          <MapPinned className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className={mock.title}>Choose a location</h1>
          <p className={mock.subtitle}>
            Quickly manage your locations and track your campaigns and rank with ease.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MockMetricCard
          label="Active Locations"
          value={String(activeLocations || locations.length)}
          hint={`${locations.length} total in account`}
          icon={Building2}
          iconClassName="bg-[#ECFDF3] text-[#027A48]"
        />
        <MockMetricCard
          label="Total Campaigns"
          value={String(totalCampaigns)}
          hint="Across all locations"
          icon={FolderKanban}
          iconClassName="bg-[#F0F9FF] text-[#026AA2]"
        />
        <MockMetricCard
          label="Completed Runs"
          value={String(completedRuns)}
          hint="Finished Maps scans"
          icon={PlayCircle}
          iconClassName="bg-[#EFF8FF] text-[#175CD3]"
        />
        <MockMetricCard
          label="Total Credit"
          value={
            mapCreditsRemaining != null ? mapCreditsRemaining.toLocaleString() : "—"
          }
          hint={
            mapCreditsLimit != null
              ? `of ${mapCreditsLimit.toLocaleString()} available`
              : "Available"
          }
          icon={Coins}
          iconClassName="bg-[#F4F3FF] text-[#5925DC]"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)]">
        <section className={cn(mock.card, "overflow-hidden")}>
          <div className="space-y-3 border-b border-[#F2F4F7] px-4 py-3.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search locations or campaigns…"
                className="h-10 w-full rounded-lg border border-[#E6EAF0] bg-white pl-9 pr-3 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFilter(f.id);
                      setPage(0);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                      filter === f.id
                        ? "bg-[#137752] text-white"
                        : "bg-[#F2F4F7] text-[#475467] hover:bg-[#E6EAF0]"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#667085]">
                Sort by:
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "newest" | "name")}
                  className="rounded-md border border-[#E6EAF0] bg-white px-2 py-1 text-[12px] font-semibold text-[#344054] outline-none focus:border-[#137752]"
                >
                  <option value="newest">Newest Updated</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>
          </div>

          {!pageRows.length ? (
            <p className="px-4 py-10 text-center text-sm text-[#667085]">
              No locations match this filter.
            </p>
          ) : (
            <ul className="divide-y divide-[#F2F4F7]">
              {pageRows.map((loc) => {
                const isProspect =
                  loc.accountType === "prospect" || loc.isTracked === false;
                const href = `/businesses/${loc.id}/campaigns`;
                return (
                  <li
                    key={loc.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          isProspect
                            ? "bg-[#EFF8FF] text-[#175CD3]"
                            : "bg-[#ECFDF3] text-[#027A48]"
                        )}
                      >
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-semibold text-[#101828]">
                            {loc.name}
                          </p>
                          <span className={statusBadge(loc.status)}>
                            {statusLabel(loc.status)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-[#667085]">
                          {loc.keywordCount} Keyword{loc.keywordCount === 1 ? "" : "s"}
                          {" · "}
                          {loc.campaignCount} Campaign{loc.campaignCount === 1 ? "" : "s"}
                          {" · Started "}
                          {formatWhen(loc.latestUpdatedAt)}
                          {" · "}
                          {loc.activeCampaignCount}/{loc.campaignCount || 0}
                        </p>
                      </div>
                    </div>
                    <Link href={href} className={cn(mock.btnPrimary, "h-9 shrink-0 px-3.5 text-[12px]")}>
                      View Campaign
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center justify-center gap-3 border-t border-[#F2F4F7] px-4 py-3 text-[12px] text-[#667085]">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md p-1 hover:bg-[#F2F4F7] disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Showing {from} to {to} of {filtered.length} results
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-md p-1 hover:bg-[#F2F4F7] disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className={cn(mock.cardPad, "space-y-3")}>
            <h2 className="text-[14px] font-bold text-[#101828]">Location overview</h2>
            <div className="space-y-2.5 text-[13px] text-[#475467]">
              <div className="flex items-center justify-between gap-2">
                <span>{locations.length} Locations tracked</span>
                <CheckCircle2 className="h-4 w-4 text-[#137752]" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>
                  {totalCampaigns} campaign{totalCampaigns === 1 ? "" : "s"}
                </span>
                <FolderKanban className="h-4 w-4 text-[#667085]" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>
                  {completedRuns} completed run{completedRuns === 1 ? "" : "s"}
                </span>
                <PlayCircle className="h-4 w-4 text-[#667085]" />
              </div>
            </div>
            <Link href="/clients" className={mock.link}>
              Manage locations
            </Link>
          </div>

          <div className={cn(mock.card, "overflow-hidden")}>
            <div className="border-b border-[#F2F4F7] px-4 py-3">
              <h2 className="text-[14px] font-bold text-[#101828]">Notifications</h2>
            </div>
            {!recentActivity.length ? (
              <p className="px-4 py-4 text-[13px] text-[#667085]">No recent campaign activity.</p>
            ) : (
              <ul className="divide-y divide-[#F2F4F7]">
                {recentActivity.map((loc) => (
                  <li key={loc.id} className="px-4 py-3">
                    <p className="truncate text-[13px] font-semibold text-[#101828]">
                      {loc.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#667085]">
                      {loc.latestCampaignName || "Location"} · {formatWhen(loc.latestUpdatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn(mock.cardPad, "space-y-3")}>
            <h2 className="text-[14px] font-bold text-[#101828]">Quick links</h2>
            <Link
              href={createHref}
              className={cn(mock.btnPrimary, "h-10 w-full")}
            >
              <Plus className="h-4 w-4" />
              Create campaign
            </Link>
            <Link href="/workspace" className={cn(mock.btnSecondary, "h-10 w-full")}>
              <Sparkles className="h-4 w-4" />
              Open workspace
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
