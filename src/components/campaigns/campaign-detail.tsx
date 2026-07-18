"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import type { CampaignScheduleType } from "@/lib/campaigns/types";

type Keyword = {
  id: string;
  keyword: string;
  is_primary?: boolean;
  active?: boolean;
  sort_order?: number;
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
};

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function saveSchedule(patch: Partial<{
    scheduleType: CampaignScheduleType;
    scheduleEnabled: boolean;
    scheduleDay: number | null;
    scheduleTimezone: string | null;
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
      window.location.href = `/businesses/${campaign.business_id}/overview`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run campaign");
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
        subtitle={`${businessName || "Location"} · ${campaign.default_grid_size}×${campaign.default_grid_size} grid · ${Math.round(campaign.default_radius_meters / 1609.34 * 10) / 10} mi radius`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || keywords.filter((k) => k.active !== false).length < 1}
              onClick={() => void runAllKeywords()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run all keywords
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Keywords</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Each keyword remains an independent scan for data integrity.
          </p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {keywords.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-zinc-900">{k.keyword}</span>
                <span className="text-xs text-zinc-400">
                  {k.active === false ? "Paused" : "Active"}
                </span>
              </li>
            ))}
            {keywords.length === 0 ? (
              <li className="py-2 text-sm text-zinc-500">No keywords in this campaign yet.</li>
            ) : null}
          </ul>
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

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Schedule</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Weekly, every two weeks, or monthly. Incomplete scans never become reports.
          </p>
          <label className="mt-3 block text-sm">
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/businesses/${campaign.business_id}/reports`}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Create report
            </Link>
            <Link
              href={`/businesses/${campaign.business_id}/scans`}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              View scans
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
