"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Campaign = { id: string; name: string; description: string | null; schedule_type: string };

export default function BusinessCampaignsPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCampaigns(json.campaigns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCampaign() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Group keywords and schedule recurring Maps scans for this location."
      />
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="New campaign name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void createCampaign()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create campaign
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-zinc-900">No campaigns yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Create a campaign to keep related keywords and recurring scans organized for this
            client location.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="text-sm font-semibold text-zinc-900 hover:text-emerald-700"
                >
                  {c.name}
                </Link>
                <p className="text-xs capitalize text-zinc-500">{c.schedule_type} schedule</p>
              </div>
              <Link
                href={`/campaigns/${c.id}`}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
