"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Loader2,
  Pause,
  Play,
  Plus,
  QrCode,
  Sparkles,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import {
  RepBadge,
  RepMetricCard,
  RepSearch,
  rep,
} from "@/components/reputation/rep-ui";
import {
  QR_PLACEMENT_LABELS,
  QR_PLACEMENT_TYPES,
  type QrPlacementType,
  type ReviewQrCampaign,
} from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

type ListResponse = {
  campaigns?: ReviewQrCampaign[];
  canCreateMore?: boolean;
  limits?: { maxActive: number; activeCount: number };
  error?: string;
  limitKey?: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function placementLabel(c: ReviewQrCampaign): string {
  if (c.placementType === "custom" && c.customPlacementLabel) return c.customPlacementLabel;
  return QR_PLACEMENT_LABELS[c.placementType] ?? c.placementType;
}

export function QrCampaignsList({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<ReviewQrCampaign[]>([]);
  const [canCreateMore, setCanCreateMore] = useState(true);
  const [limits, setLimits] = useState<{ maxActive: number; activeCount: number } | null>(null);
  const [search, setSearch] = useState("");
  const [placement, setPlacement] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ businessId, status: "all" });
      const res = await fetch(`/api/reputation/qr-campaigns?${params}`);
      const json = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(json.error ?? "Failed to load campaigns");
      setCampaigns(json.campaigns ?? []);
      setCanCreateMore(json.canCreateMore !== false);
      setLimits(json.limits ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (placement !== "all" && c.placementType !== placement) return false;
      if (!q) return true;
      const hay = `${c.name} ${placementLabel(c)} ${c.shortCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [campaigns, placement, search, status]);

  const summary = useMemo(() => {
    const totalScans = campaigns.reduce((n, c) => n + (c.totalScans || 0), 0);
    const totalUnique = campaigns.reduce((n, c) => n + (c.estimatedUniqueScans || 0), 0);
    const byPlacement = new Map<string, number>();
    for (const c of campaigns) {
      const key = placementLabel(c);
      byPlacement.set(key, (byPlacement.get(key) ?? 0) + (c.totalScans || 0));
    }
    let topPlacement = "—";
    let topScans = -1;
    for (const [label, scans] of byPlacement) {
      if (scans > topScans) {
        topScans = scans;
        topPlacement = label;
      }
    }
    return { totalScans, totalUnique, topPlacement };
  }, [campaigns]);

  async function duplicate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "duplicate" }),
      });
      const json = (await res.json()) as { campaign?: ReviewQrCampaign; error?: string; limitKey?: string };
      if (!res.ok) throw new Error(json.error ?? "Duplicate failed");
      if (json.campaign?.id) {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns/${json.campaign.id}`);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(c: ReviewQrCampaign) {
    const next = c.status === "active" ? "paused" : "active";
    setBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, patch: { status: next } }),
      });
      const json = (await res.json()) as { error?: string; limitKey?: string };
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) {
          throw new Error(
            json.error ??
              "Plan limit reached. Pause another campaign or upgrade to activate more."
          );
        }
        throw new Error(json.error ?? "Could not update status");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModulePage className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={rep.title}>QR Campaigns</h1>
          <p className={rep.subtitle}>
            Trackable Google review QR codes for posters, counters, vehicles, and more.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateMore ? (
            <Link
              href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
              className={rep.btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Create
            </Link>
          ) : (
            <button type="button" className={cn(rep.btnPrimary, "opacity-60")} disabled>
              <Plus className="h-4 w-4" />
              Create
            </button>
          )}
        </div>
      </div>

      {!canCreateMore ? (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Campaign limit reached</p>
            <p className="mt-0.5">
              {limits
                ? `You're using ${limits.activeCount} of ${limits.maxActive} active QR campaigns.`
                : "Your plan's active QR campaign limit is full."}{" "}
              Pause a campaign or{" "}
              <Link href={`/businesses/${businessId}/settings`} className="font-semibold underline">
                upgrade
              </Link>{" "}
              to track more placements.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RepMetricCard label="Total campaigns" value={campaigns.length} icon={QrCode} />
        <RepMetricCard label="Total scans" value={summary.totalScans.toLocaleString()} />
        <RepMetricCard label="Est. unique" value={summary.totalUnique.toLocaleString()} />
        <RepMetricCard label="Top placement" value={summary.topPlacement} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <RepSearch
          value={search}
          onChange={setSearch}
          placeholder="Search campaigns…"
          className="min-w-[220px]"
        />
        <div>
          <label className={rep.label}>Placement</label>
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            className={cn(rep.select, "mt-1 block")}
          >
            <option value="all">All placements</option>
            {QR_PLACEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {QR_PLACEMENT_LABELS[t as QrPlacementType]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rep.label}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(rep.select, "mt-1 block")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin text-[#137752]" />
          Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <div className={cn(rep.card, "border-dashed p-10 text-center")}>
          <QrCode className="mx-auto h-8 w-8 text-[#137752]" />
          <h2 className="mt-3 text-lg font-semibold text-[#101828]">No QR campaigns yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#667085]">
            Create a tracked Google review QR code for your front desk, receipts, or job sites.
          </p>
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
            className={cn(rep.btnPrimary, "mt-4")}
          >
            <Plus className="h-4 w-4" />
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className={cn(rep.card, "overflow-x-auto")}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Placement</th>
                <th className="px-4 py-3">Scans</th>
                <th className="px-4 py-3">Unique</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last scan</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[#E6EAF0] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#101828]">
                    <Link
                      href={`/businesses/${businessId}/reputation/qr-campaigns/${c.id}`}
                      className="hover:text-[#137752] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{placementLabel(c)}</td>
                  <td className="px-4 py-3 text-[#475467]">{c.totalScans.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#475467]">
                    {c.estimatedUniqueScans.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <RepBadge
                      tone={
                        c.status === "active"
                          ? "green"
                          : c.status === "paused"
                            ? "amber"
                            : "gray"
                      }
                    >
                      {c.status}
                    </RepBadge>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{formatDate(c.lastScannedAt)}</td>
                  <td className="px-4 py-3 text-[#475467]">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/businesses/${businessId}/reputation/qr-campaigns/${c.id}`}
                        className={cn(rep.btnSecondary, "h-8 px-2.5 text-xs")}
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/businesses/${businessId}/reputation/qr-campaigns/${c.id}/analytics`}
                        className={cn(rep.btnSecondary, "h-8 px-2.5 text-xs")}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Analytics
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void duplicate(c.id)}
                        className={cn(rep.btnSecondary, "h-8 px-2.5 text-xs")}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void toggleStatus(c)}
                        className={cn(rep.btnSecondary, "h-8 px-2.5 text-xs")}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : c.status === "active" ? (
                          <>
                            <Pause className="h-3.5 w-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" /> Activate
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#667085]">
                    No campaigns match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </ModulePage>
  );
}
