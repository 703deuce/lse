"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Pause, Play, X } from "lucide-react";
import { rrOutlineBtn } from "@/components/reputation/review-requests-ui";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  channel: string;
  created_at: string;
  recipients_total: number;
  recipients_ready: number;
  queued: number;
  sent: number;
  failed: number;
  clicked: number;
  opted_out: number;
};

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700",
    scheduled: "bg-blue-50 text-blue-700",
    active: "bg-emerald-50 text-emerald-700",
    paused: "bg-amber-50 text-amber-700",
    completed: "bg-zinc-100 text-zinc-600",
    cancelled: "bg-red-50 text-red-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", styles[status] ?? styles.draft)}>
      {status}
    </span>
  );
}

export function ReviewRequestsCampaignsTable({ businessId }: { businessId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reputation/review-requests/campaigns?businessId=${businessId}`);
      const json = await res.json();
      if (res.ok) setCampaigns(json.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(campaignId: string, act: string) {
    setMenuId(null);
    await fetch(`/api/reputation/review-requests/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, action: act }),
    });
    await load();
  }

  async function duplicate(campaignId: string) {
    setMenuId(null);
    await fetch("/api/reputation/review-requests/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, duplicateFrom: campaignId }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className={cn(dashboardCard, "border-dashed px-3.5 py-8 text-center text-[13px] text-zinc-500")}>
        No bulk campaigns yet. Upload a CSV in the Bulk Upload tab to get started.
      </div>
    );
  }

  return (
    <div className={cn(dashboardCard, "overflow-hidden")}>
      <div className="border-b border-zinc-100 px-3.5 py-2.5">
        <h3 className={dashboardCardTitle}>Bulk campaigns</h3>
        <p className={dashboardMicro}>Paced CSV campaigns — clicks tracked, not review attribution.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2 text-right">Recipients</th>
              <th className="px-3 py-2 text-right">Queued</th>
              <th className="px-3 py-2 text-right">Sent</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2 text-right">Clicked</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-50/80">
                <td className="px-3 py-2 font-medium text-zinc-900">{c.name}</td>
                <td className="px-3 py-2">{statusBadge(c.status)}</td>
                <td className="px-3 py-2 capitalize text-zinc-600">{c.channel}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.recipients_ready}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.queued}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{c.sent}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">{c.failed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.clicked}</td>
                <td className="px-3 py-2 text-[11px] text-zinc-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="relative px-3 py-2">
                  <button type="button" className={rrOutlineBtn} onClick={() => setMenuId(menuId === c.id ? null : c.id)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuId === c.id && (
                    <div className="absolute right-3 z-10 mt-1 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                      {c.status === "active" && (
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50" onClick={() => void action(c.id, "pause")}>
                          <Pause className="h-3 w-3" /> Pause
                        </button>
                      )}
                      {c.status === "paused" && (
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50" onClick={() => void action(c.id, "resume")}>
                          <Play className="h-3 w-3" /> Resume
                        </button>
                      )}
                      {c.status === "draft" && (
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50" onClick={() => void action(c.id, "start")}>
                          <Play className="h-3 w-3" /> Start
                        </button>
                      )}
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50" onClick={() => void duplicate(c.id)}>
                        Duplicate
                      </button>
                      {!["completed", "cancelled"].includes(c.status) && (
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50" onClick={() => void action(c.id, "cancel")}>
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
