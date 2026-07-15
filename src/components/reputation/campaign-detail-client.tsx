"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Pause, Play, X } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Metrics = {
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  clicked: number;
  failed: number;
  opted_out: number;
  replied: number;
};

type Recipient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  workflow_status: string | null;
  replied_at: string | null;
  latest_message: {
    status: string;
    channel: string;
    sent_at: string | null;
    scheduled_for: string;
    clicked_at: string | null;
  } | null;
};

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[6.5rem] rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export function CampaignDetailClient({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ businessId, limit: "50" });
        if (opts?.cursor) params.set("cursor", opts.cursor);
        const res = await fetch(
          `/api/reputation/review-requests/campaigns/${campaignId}?${params}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setCampaign(json.campaign);
        setMetrics(json.metrics);
        setRecipients((prev) =>
          opts?.append ? [...prev, ...(json.recipients?.items ?? [])] : json.recipients?.items ?? []
        );
        setNextCursor(json.recipients?.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [businessId, campaignId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function action(act: string) {
    setError(null);
    const res = await fetch(`/api/reputation/review-requests/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, action: act }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : `Failed to ${act}`);
      return;
    }
    await load();
  }

  const status = String(campaign?.status ?? "");
  const name = String(campaign?.name ?? "Campaign");
  const autoPause = campaign?.auto_pause_reason
    ? String(campaign.auto_pause_reason)
    : null;

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/businesses/${businessId}/review-campaigns`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">{name}</h1>
          <p className="mt-0.5 text-[13px] text-zinc-600">
            Status: <span className="font-medium capitalize text-zinc-800">{status || "—"}</span>
            {autoPause ? ` · Paused: ${autoPause}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {status === "active" && (
            <button
              type="button"
              onClick={() => void action("pause")}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          )}
          {(status === "paused" || status === "draft") && (
            <button
              type="button"
              onClick={() => void action(status === "draft" ? "start" : "resume")}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-500"
            >
              <Play className="h-3.5 w-3.5" /> {status === "draft" ? "Start" : "Resume"}
            </button>
          )}
          {!["completed", "cancelled", "archived"].includes(status) && (
            <button
              type="button"
              onClick={() => void action("cancel")}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {metrics ? (
          <>
            <MicroStat label="Sent" value={String(metrics.sent)} />
            <MicroStat label="Delivered" value={String(metrics.delivered)} />
            <MicroStat label="Clicked" value={String(metrics.clicked)} />
            <MicroStat label="Replied" value={String(metrics.replied)} />
            <MicroStat label="Opted out" value={String(metrics.opted_out)} />
            <MicroStat label="Failed" value={String(metrics.failed)} />
            <MicroStat label="Queued" value={String(metrics.queued + metrics.sending)} />
          </>
        ) : (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading metrics…
          </div>
        )}
      </div>

      {/* Compact funnel */}
      {metrics && metrics.sent > 0 && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Funnel</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            {[
              { label: "Sent", n: metrics.sent },
              { label: "Delivered", n: metrics.delivered },
              { label: "Clicked", n: metrics.clicked },
              { label: "Replied", n: metrics.replied },
            ].map((step) => {
              const pct = Math.max(8, Math.round((step.n / metrics.sent) * 100));
              return (
                <div key={step.label} className="min-w-[4.5rem] flex-1">
                  <div
                    className="rounded-sm bg-emerald-500/80"
                    style={{ height: `${Math.min(56, pct * 0.5)}px` }}
                  />
                  <p className="mt-1 text-[11px] font-medium text-zinc-800">
                    {step.n}{" "}
                    <span className="font-normal text-zinc-500">{step.label}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Clicks are tracked. Review completions are not claimed unless attribution is confirmed.
          </p>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-[12px]">
          <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2.5 py-2 font-medium">Customer</th>
              <th className="px-2.5 py-2 font-medium">Channel</th>
              <th className="px-2.5 py-2 font-medium">Status</th>
              <th className="px-2.5 py-2 font-medium">Delivered</th>
              <th className="px-2.5 py-2 font-medium">Clicked</th>
              <th className="px-2.5 py-2 font-medium">Replied</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => {
              const label =
                r.full_name ||
                [r.first_name, r.last_name].filter(Boolean).join(" ") ||
                r.phone ||
                r.email ||
                "—";
              const msg = r.latest_message;
              return (
                <tr key={r.id} className="border-b border-zinc-50">
                  <td className="px-2.5 py-1.5 font-medium text-zinc-900">{label}</td>
                  <td className="px-2.5 py-1.5 capitalize text-zinc-600">{msg?.channel ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-zinc-700">{msg?.status ?? r.status}</td>
                  <td className="px-2.5 py-1.5 text-zinc-600">
                    {msg && ["sent", "delivered", "clicked"].includes(msg.status) ? "Yes" : "—"}
                  </td>
                  <td className="px-2.5 py-1.5 text-zinc-600">{msg?.clicked_at ? "Yes" : "—"}</td>
                  <td className="px-2.5 py-1.5 text-zinc-600">{r.replied_at ? "Yes" : "—"}</td>
                </tr>
              );
            })}
            {!loading && recipients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2.5 py-8 text-center text-zinc-500">
                  No recipients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      )}
      {nextCursor && (
        <button
          type="button"
          className={cn("mt-2 text-[12px] font-medium text-emerald-700 hover:underline")}
          onClick={() => void load({ append: true, cursor: nextCursor })}
        >
          Load more
        </button>
      )}
    </ModulePage>
  );
}
