"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, GitCompare, Loader2, Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import type { CampaignScheduleType } from "@/lib/campaigns/types";

type Keyword = {
  id: string;
  keyword: string;
  is_primary?: boolean;
  active?: boolean;
  sort_order?: number;
  latestAverage?: number | null;
  top3Pct?: number | null;
  previousChange?: number | null;
  lastScanAt?: string | null;
  latestScanId?: string | null;
  previousScanId?: string | null;
  status?: "never_scanned" | "running" | "ready" | "stale" | "paused";
};

type Campaign = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  default_grid_size: number;
  default_radius_meters: number;
  schedule_type: CampaignScheduleType;
  schedule_enabled: boolean;
  schedule_day: number | null;
  schedule_timezone: string | null;
  next_scheduled_at: string | null;
  baseline_scan_batch_id?: string | null;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function statusLabel(status: Keyword["status"]): string {
  switch (status) {
    case "running":
      return "Running";
    case "stale":
      return "Needs refresh";
    case "paused":
      return "Paused";
    case "ready":
      return "Ready";
    default:
      return "Not scanned";
  }
}

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load campaign");
      setCampaign(json.campaign);
      setKeywords(json.keywords ?? []);
      setBusinessName(json.business?.name ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const compareCandidates = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    for (const k of keywords) {
      if (k.latestScanId) {
        out.push({
          id: k.latestScanId,
          label: `${k.keyword} · latest`,
        });
      }
      if (k.previousScanId) {
        out.push({
          id: k.previousScanId,
          label: `${k.keyword} · previous`,
        });
      }
    }
    return out;
  }, [keywords]);

  async function saveSchedule(patch: Partial<{
    scheduleType: CampaignScheduleType;
    scheduleEnabled: boolean;
    scheduleDay: number | null;
    scheduleTimezone: string | null;
    baselineScanBatchId: string | null;
  }>) {
    if (!campaign) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setCampaign(json.campaign);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function addKeyword() {
    if (!campaign || !newKeyword.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scans/keywords/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: campaign.business_id,
          keyword: newKeyword.trim(),
          campaignId: campaign.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not add keyword");
      setNewKeyword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add keyword");
    } finally {
      setBusy(false);
    }
  }

  async function runAllKeywords() {
    if (!campaign) return;
    const active = keywords.filter((k) => k.active !== false);
    if (!active.length) {
      setError("Add at least one active keyword first.");
      return;
    }
    if (
      !confirm(
        `This will create ${active.length} background scan${active.length === 1 ? "" : "s"}. Continue?`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const kw of active) {
        const res = await fetch("/api/scans/run-for-keyword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: campaign.business_id,
            keywordId: kw.id,
            gridSize: campaign.default_grid_size,
            radiusMeters: campaign.default_radius_meters,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `Failed to queue ${kw.keyword}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run campaign");
    } finally {
      setBusy(false);
    }
  }

  async function archiveCampaign() {
    if (!confirm("Archive this campaign? Keywords and past scans stay saved.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Archive failed");
      window.location.href = `/businesses/${campaign?.business_id}/campaigns`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archive failed");
      setBusy(false);
    }
  }

  async function duplicateCampaign() {
    if (!campaign) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: campaign.business_id,
          name: `${campaign.name} (copy)`,
          description: campaign.description,
          defaultGridSize: campaign.default_grid_size,
          defaultRadiusMeters: campaign.default_radius_meters,
          scheduleType: "manual",
          scheduleEnabled: false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Duplicate failed");
      const newId = json.campaign?.id as string | undefined;
      if (newId) {
        for (const kw of keywords) {
          await fetch("/api/scans/keywords/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: campaign.business_id,
              keyword: kw.keyword,
              campaignId: newId,
            }),
          });
        }
        window.location.href = `/campaigns/${newId}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusy(false);
    }
  }

  function openCompare() {
    if (!campaign || !compareA || !compareB || compareA === compareB) {
      setError("Pick two different scans to compare.");
      return;
    }
    window.location.href = `/businesses/${campaign.business_id}/grid/${compareB}?compare=${compareA}`;
  }

  async function markBaselineFromLatest() {
    const first = keywords.find((k) => k.latestScanId)?.latestScanId;
    if (!first) {
      setError("Run at least one scan before setting a campaign baseline.");
      return;
    }
    await saveSchedule({ baselineScanBatchId: first });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-red-600">{error ?? "Campaign not found"}</p>;
  }

  const reportHref = `/businesses/${campaign.business_id}/reports?type=maps_campaign&campaignId=${campaign.id}`;

  return (
    <>
      <Link
        href={`/clients/${campaign.business_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {businessName || "Client"}
      </Link>

      <PageHeader
        title={campaign.name}
        subtitle={`${businessName || "Location"} · ${campaign.default_grid_size}×${campaign.default_grid_size} grid · ${Math.round((campaign.default_radius_meters / 1609.34) * 10) / 10} mi radius`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || keywords.filter((k) => k.active !== false).length < 1}
              onClick={() => void runAllKeywords()}
              className="inline-flex items-center gap-2 rounded-full bg-[#137752] px-3 py-2 text-sm font-medium text-white hover:bg-[#0f6344] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run all
            </button>
            <Link
              href={reportHref}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <FileText className="h-4 w-4" />
              Create report
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowSchedule((v) => !v)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Edit schedule
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void duplicateCampaign()}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void archiveCampaign()}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Archive
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Keywords</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Latest average, Top 3 coverage, change vs previous scan, and status — without
              opening every grid.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
            >
              <option value="">Compare period A</option>
              {compareCandidates.map((c) => (
                <option key={`a-${c.id}-${c.label}`} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
            >
              <option value="">Compare period B</option>
              {compareCandidates.map((c) => (
                <option key={`b-${c.id}-${c.label}`} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openCompare}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <GitCompare className="h-3.5 w-3.5" />
              Compare period
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3 font-medium">Keyword</th>
                <th className="py-2 pr-3 font-medium">Latest average</th>
                <th className="py-2 pr-3 font-medium">Top 3</th>
                <th className="py-2 pr-3 font-medium">Previous change</th>
                <th className="py-2 pr-3 font-medium">Last scan</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {keywords.map((k) => {
                const delta = k.previousChange;
                const deltaClass =
                  delta == null
                    ? "text-zinc-400"
                    : delta > 0
                      ? "text-emerald-700"
                      : delta < 0
                        ? "text-red-600"
                        : "text-zinc-600";
                return (
                  <tr key={k.id}>
                    <td className="py-2.5 pr-3 font-medium text-zinc-900">
                      {k.latestScanId ? (
                        <Link
                          href={`/businesses/${campaign.business_id}/grid/${k.latestScanId}`}
                          className="hover:underline"
                        >
                          {k.keyword}
                        </Link>
                      ) : (
                        k.keyword
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-800">{fmtNum(k.latestAverage)}</td>
                    <td className="py-2.5 pr-3 text-zinc-800">
                      {k.top3Pct == null ? "—" : `${fmtNum(k.top3Pct)}%`}
                    </td>
                    <td className={`py-2.5 pr-3 font-medium ${deltaClass}`}>
                      {delta == null ? "—" : delta > 0 ? `+${fmtNum(delta)}` : fmtNum(delta)}
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-600">
                      {k.lastScanAt ? new Date(k.lastScanAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-zinc-500">{statusLabel(k.status)}</td>
                  </tr>
                );
              })}
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-sm text-zinc-500">
                    No keywords in this campaign yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Add keyword"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addKeyword();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !newKeyword.trim()}
            onClick={() => void addKeyword()}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </section>

      {showSchedule ? (
        <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Schedule</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Weekly, every two weeks, or monthly. Incomplete scans never become reports.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Cadence</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={campaign.schedule_type}
                disabled={busy}
                onChange={(e) =>
                  void saveSchedule({
                    scheduleType: e.target.value as CampaignScheduleType,
                    scheduleEnabled: e.target.value !== "manual",
                  })
                }
              >
                <option value="manual">Manual</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every two weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-zinc-700">Day of week / month</span>
              <input
                type="number"
                min={0}
                max={31}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={campaign.schedule_day ?? ""}
                disabled={busy || campaign.schedule_type === "manual"}
                placeholder={campaign.schedule_type === "monthly" ? "1–31" : "0=Sun … 6=Sat"}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  void saveSchedule({ scheduleDay: v });
                }}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={campaign.schedule_enabled}
              disabled={busy || campaign.schedule_type === "manual"}
              onChange={(e) => void saveSchedule({ scheduleEnabled: e.target.checked })}
            />
            Schedule enabled
          </label>
          {campaign.next_scheduled_at ? (
            <p className="mt-2 text-xs text-zinc-500">
              Next run: {new Date(campaign.next_scheduled_at).toLocaleString()}
            </p>
          ) : null}
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <h3 className="text-sm font-semibold text-zinc-900">Campaign baseline</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Mark a scan as the starting point so monthly reports can show baseline vs current.
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              {campaign.baseline_scan_batch_id
                ? `Baseline set: ${campaign.baseline_scan_batch_id.slice(0, 8)}…`
                : "No baseline set yet."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markBaselineFromLatest()}
              className="mt-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Use latest keyword scan as baseline
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
