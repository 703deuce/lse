"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Upload, UserPlus, FileText } from "lucide-react";
import { ModulePage, TabBar } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import {
  ReviewRequestsCampaignsTable,
  type CampaignRow,
} from "@/components/reputation/review-requests-campaigns";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import { CampaignCreateWizard } from "@/components/reputation/campaign-create-wizard";
import { cn } from "@/lib/utils";

type CampaignTab = "active" | "drafts" | "completed" | "analytics";

const CAMPAIGN_TABS: Array<{ id: CampaignTab; label: string }> = [
  { id: "active", label: "Active" },
  { id: "drafts", label: "Drafts" },
  { id: "completed", label: "Completed" },
  { id: "analytics", label: "Analytics" },
];

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[calc(50%-0.25rem)] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 sm:min-w-[7.5rem] sm:flex-none">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

function CampaignAnalytics({ campaigns, loading }: { campaigns: CampaignRow[]; loading: boolean }) {
  const analytics = useMemo(() => {
    const sent = campaigns.reduce((n, c) => n + (c.sent ?? 0), 0);
    const delivered = campaigns.reduce((n, c) => n + (c.delivered ?? 0), 0);
    const clicked = campaigns.reduce((n, c) => n + (c.clicked ?? 0), 0);
    const opted = campaigns.reduce((n, c) => n + (c.opted_out ?? 0), 0);
    const reviews = campaigns.reduce((n, c) => n + (c.reviews_detected ?? 0), 0);
    const byChannel = ["sms", "email", "both"].map((channel) => {
      const rows = campaigns.filter((c) => c.channel === channel);
      return {
        channel,
        campaigns: rows.length,
        sent: rows.reduce((n, c) => n + (c.sent ?? 0), 0),
        clicked: rows.reduce((n, c) => n + (c.clicked ?? 0), 0),
        opted: rows.reduce((n, c) => n + (c.opted_out ?? 0), 0),
      };
    });
    const byTemplate = new Map<
      string,
      { label: string; campaigns: number; sent: number; clicked: number; reviews: number }
    >();
    for (const c of campaigns) {
      const ids = [c.source_template_id, c.template_id, c.email_template_id].filter(Boolean);
      const key = ids.join(" + ") || "No template id";
      const bucket = byTemplate.get(key) ?? {
        label: key,
        campaigns: 0,
        sent: 0,
        clicked: 0,
        reviews: 0,
      };
      bucket.campaigns++;
      bucket.sent += c.sent ?? 0;
      bucket.clicked += c.clicked ?? 0;
      bucket.reviews += c.reviews_detected ?? 0;
      byTemplate.set(key, bucket);
    }
    const byWindow = new Map<string, { window: string; campaigns: number; sent: number; clicked: number }>();
    for (const c of campaigns) {
      const window =
        c.send_window_start && c.send_window_end
          ? `${c.send_window_start}-${c.send_window_end}${c.timezone ? ` ${c.timezone}` : ""}`
          : "—";
      const bucket = byWindow.get(window) ?? { window, campaigns: 0, sent: 0, clicked: 0 };
      bucket.campaigns++;
      bucket.sent += c.sent ?? 0;
      bucket.clicked += c.clicked ?? 0;
      byWindow.set(window, bucket);
    }
    return {
      sent,
      delivered,
      clicked,
      opted,
      reviews,
      byChannel,
      byTemplate: [...byTemplate.values()].sort((a, b) => b.sent - a.sent),
      byWindow: [...byWindow.values()].sort((a, b) => b.sent - a.sent),
    };
  }, [campaigns]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading campaign analytics…
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-[13px] text-zinc-500">
        No campaign data yet. Launch a campaign before analytics are available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MicroStat label="Requests sent" value={String(analytics.sent)} />
        <MicroStat label="Delivery rate" value={pct(analytics.delivered, analytics.sent)} />
        <MicroStat label="Click rate" value={pct(analytics.clicked, analytics.delivered || analytics.sent)} />
        <MicroStat label="Opt-out rate" value={pct(analytics.opted, analytics.sent)} />
        <MicroStat label="Likely/confirmed reviews" value={String(analytics.reviews)} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-3.5 py-2.5">
          <h3 className="text-[13px] font-semibold text-zinc-900">SMS vs email</h3>
          <p className="text-[11px] text-zinc-500">
            Grouped by configured campaign channel. Per-message channel performance is not included in the loaded campaign summary.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3.5 py-2 font-medium">Channel</th>
                <th className="px-3.5 py-2 text-right font-medium">Campaigns</th>
                <th className="px-3.5 py-2 text-right font-medium">Sent</th>
                <th className="px-3.5 py-2 text-right font-medium">Clicked</th>
                <th className="px-3.5 py-2 text-right font-medium">Opt-outs</th>
                <th className="px-3.5 py-2 text-right font-medium">Click rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {analytics.byChannel.map((row) => (
                <tr key={row.channel}>
                  <td className="px-3.5 py-2 capitalize text-zinc-900">{row.channel}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{row.campaigns}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{row.sent}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{row.clicked}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{row.opted}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{pct(row.clicked, row.sent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3.5 py-2.5">
            <h3 className="text-[13px] font-semibold text-zinc-900">Template comparison</h3>
            <p className="text-[11px] text-zinc-500">
              Template names and usage counts are not loaded here, so IDs are shown when available.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3.5 py-2 font-medium">Template</th>
                  <th className="px-3.5 py-2 text-right font-medium">Campaigns</th>
                  <th className="px-3.5 py-2 text-right font-medium">Sent</th>
                  <th className="px-3.5 py-2 text-right font-medium">Clicked</th>
                  <th className="px-3.5 py-2 text-right font-medium">Reviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {analytics.byTemplate.map((row) => (
                  <tr key={row.label}>
                    <td className="max-w-[16rem] truncate px-3.5 py-2 font-mono text-[11px] text-zinc-700">
                      {row.label}
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{row.campaigns}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{row.sent}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{row.clicked}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{row.reviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3.5 py-2.5">
            <h3 className="text-[13px] font-semibold text-zinc-900">Send-time windows</h3>
            <p className="text-[11px] text-zinc-500">
              Uses configured send windows. Per-hour send performance is not in the loaded campaign summary.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3.5 py-2 font-medium">Window</th>
                  <th className="px-3.5 py-2 text-right font-medium">Campaigns</th>
                  <th className="px-3.5 py-2 text-right font-medium">Sent</th>
                  <th className="px-3.5 py-2 text-right font-medium">Click rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {analytics.byWindow.map((row) => (
                  <tr key={row.window}>
                    <td className="px-3.5 py-2 text-zinc-700">{row.window}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{row.campaigns}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{row.sent}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{pct(row.clicked, row.sent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReviewCampaignsHub({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<CampaignTab>("active");

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

  const stats = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active" || c.status === "scheduled").length;
    const sent = campaigns.reduce((n, c) => n + (c.sent ?? 0), 0);
    const delivered = campaigns.reduce((n, c) => n + (c.delivered ?? c.sent ?? 0), 0);
    const clicked = campaigns.reduce((n, c) => n + (c.clicked ?? 0), 0);
    const opted = campaigns.reduce((n, c) => n + (c.opted_out ?? 0), 0);
    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
    const clickRate = delivered > 0 ? Math.round((clicked / delivered) * 100) : 0;
    const optRate = sent > 0 ? Math.round((opted / sent) * 100) : 0;
    const reviews = campaigns.reduce((n, c) => n + (c.reviews_detected ?? 0), 0);
    const automatic = campaigns.filter((c) => c.trigger_type === "webhook" || c.trigger_type === "api")
      .length;
    return { active, sent, deliveryRate, clickRate, optRate, reviews, automatic };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const activeStatuses = new Set(["active", "scheduled", "paused"]);
    const draftStatuses = new Set(["draft", "incomplete"]);
    const completedStatuses = new Set(["completed", "archived", "cancelled", "failed"]);
    return {
      active: campaigns.filter((c) => activeStatuses.has(c.status)),
      drafts: campaigns.filter((c) => draftStatuses.has(c.status)),
      completed: campaigns.filter((c) => completedStatuses.has(c.status)),
    };
  }, [campaigns]);

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Review Campaigns"
          subtitle="Choose how customers enter — manually or via webhook — then run one shared sequence engine."
        />
        <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setShowWizard(true);
              setShowQuickSend(false);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0f6344] sm:flex-none"
          >
            <Plus className="h-3.5 w-3.5" />
            New campaign
          </button>
          <button
            type="button"
            onClick={() => {
              setShowQuickSend(true);
              setShowWizard(false);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:flex-none"
          >
            Quick Send
          </button>
          <Link
            href={`/businesses/${businessId}/reputation/contacts?import=1`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:flex-none"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Customers
          </Link>
          <Link
            href={`/businesses/${businessId}/reputation/contacts`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:flex-none"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Customer
          </Link>
          <Link
            href={`/businesses/${businessId}/reputation/templates`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:w-auto"
          >
            <FileText className="h-3.5 w-3.5" />
            Manage Templates
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading summary…
          </div>
        ) : (
          <>
            <MicroStat label="Active campaigns" value={String(stats.active)} />
            <MicroStat label="Automatic triggers" value={String(stats.automatic)} />
            <MicroStat label="Requests sent" value={String(stats.sent)} />
            <MicroStat label="Delivery rate" value={`${stats.deliveryRate}%`} />
            <MicroStat label="Click rate" value={`${stats.clickRate}%`} />
            <MicroStat label="Likely/confirmed reviews" value={String(stats.reviews)} />
          </>
        )}
      </div>

      {showWizard ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
          <CampaignCreateWizard
            businessId={businessId}
            onCancel={() => setShowWizard(false)}
            onComplete={(campaignId) => {
              setShowWizard(false);
              setTableRefreshKey((k) => k + 1);
              void load();
              if (campaignId) {
                router.push(`/businesses/${businessId}/reputation/campaigns/${campaignId}`);
              }
            }}
          />
        </div>
      ) : null}

      {showQuickSend ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-zinc-900">Quick Send</p>
            <button
              type="button"
              onClick={() => setShowQuickSend(false)}
              className={cn("text-[12px] font-medium text-zinc-500 hover:text-zinc-800")}
            >
              Close
            </button>
          </div>
          <ReviewRequestsPanel businessId={businessId} section="send" hideSubTabs />
        </div>
      ) : null}

      <TabBar tabs={CAMPAIGN_TABS} active={activeTab} onChange={setActiveTab} className="mt-4" />

      <div className="mt-4">
        {activeTab === "active" ? (
          <ReviewRequestsCampaignsTable
            businessId={businessId}
            refreshKey={tableRefreshKey}
            campaigns={filteredCampaigns.active}
            loading={loading}
            onRefresh={load}
            title="Active campaigns"
            description="Running, scheduled, and paused campaigns from the loaded campaign list."
            emptyMessage="No active or scheduled campaigns. Start a draft or create a new campaign."
          />
        ) : null}
        {activeTab === "drafts" ? (
          <ReviewRequestsCampaignsTable
            businessId={businessId}
            refreshKey={tableRefreshKey}
            campaigns={filteredCampaigns.drafts}
            loading={loading}
            onRefresh={load}
            title="Draft campaigns"
            description="Draft and incomplete campaigns that have not launched."
            emptyMessage="No draft campaigns. Save a new campaign as draft to see it here."
          />
        ) : null}
        {activeTab === "completed" ? (
          <ReviewRequestsCampaignsTable
            businessId={businessId}
            refreshKey={tableRefreshKey}
            campaigns={filteredCampaigns.completed}
            loading={loading}
            onRefresh={load}
            title="Completed campaigns"
            description="Closed campaigns with available send, click, opt-out, and likely/confirmed review results."
            emptyMessage="No completed or archived campaigns yet."
            resultColumns
          />
        ) : null}
        {activeTab === "analytics" ? (
          <CampaignAnalytics campaigns={campaigns} loading={loading} />
        ) : null}
      </div>
    </ModulePage>
  );
}
