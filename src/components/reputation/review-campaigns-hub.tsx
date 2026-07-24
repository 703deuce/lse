"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Send,
  Star,
  Users,
  X,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import type { CampaignRow } from "@/components/reputation/review-requests-campaigns";
import { CampaignCreateWizard } from "@/components/reputation/campaign-create-wizard";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepSearch,
  rep,
} from "@/components/reputation/rep-ui";
import { cn } from "@/lib/utils";

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "—";
}

function fmt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function statusTone(status: string): "green" | "blue" | "amber" | "red" | "gray" {
  if (status === "active") return "green";
  if (status === "scheduled") return "blue";
  if (status === "paused" || status === "draft" || status === "incomplete") return "amber";
  if (status === "failed" || status === "cancelled") return "red";
  return "gray";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function nextStep(campaign: CampaignRow): string {
  if (campaign.status === "draft" || campaign.status === "incomplete") return "Finish setup";
  if (campaign.status === "paused") return "Resume enrollment";
  if (campaign.status === "scheduled") return "Starts soon";
  if (campaign.queued > 0) return `${campaign.queued} queued`;
  if (campaign.status === "active") return "Monitor performance";
  if (campaign.status === "completed") return "Review results";
  return "No action";
}

function CampaignPerformance({ campaigns }: { campaigns: CampaignRow[] }) {
  const sent = campaigns.reduce((sum, campaign) => sum + (campaign.sent ?? 0), 0);
  const delivered = campaigns.reduce((sum, campaign) => sum + (campaign.delivered ?? campaign.sent ?? 0), 0);
  const clicked = campaigns.reduce((sum, campaign) => sum + (campaign.clicked ?? 0), 0);
  const reviews = campaigns.reduce((sum, campaign) => sum + (campaign.reviews_detected ?? 0), 0);
  const maxSent = Math.max(...campaigns.map((campaign) => campaign.sent ?? 0), 1);

  return (
    <section className={cn(rep.card, "p-4")}>
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#137752]" />
        <h2 className="text-[15px] font-semibold text-[#101828]">Campaign Performance</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <p className={rep.label}>Delivery</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{pct(delivered, sent)}</p>
        </div>
        <div>
          <p className={rep.label}>Click Rate</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{pct(clicked, delivered || sent)}</p>
        </div>
        <div>
          <p className={rep.label}>Reviews</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{fmt(reviews)}</p>
        </div>
        <div>
          <p className={rep.label}>Conversion</p>
          <p className="mt-1 text-xl font-bold text-[#101828]">{pct(reviews, sent)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {campaigns.slice(0, 5).map((campaign) => (
          <div key={campaign.id}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-semibold text-[#344054]">{campaign.name}</span>
              <span className="text-xs font-bold tabular-nums text-[#101828]">{fmt(campaign.sent)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#F2F4F7]">
              <div
                className="h-full rounded-full bg-[#137752]"
                style={{ width: `${Math.max(8, ((campaign.sent ?? 0) / maxSent) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ campaigns }: { campaigns: CampaignRow[] }) {
  const activity = campaigns
    .flatMap((campaign) => [
      {
        id: `${campaign.id}-created`,
        at: campaign.created_at,
        label: `${campaign.name} created`,
        detail: `${fmt(campaign.recipients_ready)} eligible recipients`,
      },
      campaign.sent > 0
        ? {
            id: `${campaign.id}-sent`,
            at: campaign.created_at,
            label: `${campaign.name} sent ${fmt(campaign.sent)} messages`,
            detail: `${fmt(campaign.clicked)} clicks, ${fmt(campaign.reviews_detected)} reviews`,
          }
        : null,
    ])
    .filter((item): item is { id: string; at: string; label: string; detail: string } => Boolean(item))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return (
    <section className={cn(rep.card, "p-4")}>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[#137752]" />
        <h2 className="text-[15px] font-semibold text-[#101828]">Recent Activity</h2>
      </div>
      {activity.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#667085]">No campaign activity yet.</p>
      ) : (
        <ol className="space-y-4">
          {activity.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[#137752]" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#101828]">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[#667085]">
                  {formatDate(item.at)} · {item.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ReviewCampaignsHub({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    const reviews = campaigns.reduce((n, c) => n + (c.reviews_detected ?? 0), 0);
    return {
      active,
      sent,
      reviews,
      conversion: pct(reviews, sent),
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (statusFilter !== "all" && campaign.status !== statusFilter) return false;
        if (channelFilter !== "all" && campaign.channel !== channelFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!campaign.name.toLowerCase().includes(q) && !campaign.status.toLowerCase().includes(q)) {
            return false;
          }
        }
        return true;
      }),
    [campaigns, channelFilter, search, statusFilter]
  );

  async function campaignAction(campaignId: string, act: string) {
    setMenuId(null);
    setActionError(null);
    const res = await fetch(`/api/reputation/review-requests/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, action: act }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof json.error === "string" ? json.error : `Failed to ${act} campaign`);
      return;
    }
    await load();
  }

  async function duplicateCampaign(campaignId: string) {
    setMenuId(null);
    setActionError(null);
    const res = await fetch("/api/reputation/review-requests/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, duplicateFrom: campaignId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(typeof json.error === "string" ? json.error : "Failed to duplicate campaign");
      return;
    }
    await load();
  }

  return (
    <ModulePage className={rep.page}>
      <RepPageHeader
        title="Campaigns"
        subtitle="Build automated sequences to get more reviews."
        dateRangeLabel="Last 30 days"
        showFilters={false}
        actions={
          <Link href={`/businesses/${businessId}/reputation/templates`} className={rep.btnSecondary}>
            <FileText className="h-4 w-4" />
            Templates
          </Link>
        }
        primaryAction={
          <button type="button" onClick={() => setShowWizard((show) => !show)} className={rep.btnPrimary}>
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="Active Campaigns" value={loading ? "—" : fmt(stats.active)} hint="Active or scheduled" icon={Users} />
        <RepMetricCard label="Messages Sent 30d" value={loading ? "—" : fmt(stats.sent)} hint="Loaded campaign totals" icon={Send} />
        <RepMetricCard label="Reviews Generated 30d" value={loading ? "—" : fmt(stats.reviews)} hint="Likely or confirmed" icon={Star} />
        <RepMetricCard label="Est Conversion" value={loading ? "—" : stats.conversion} hint="Reviews / messages" icon={BarChart3} />
        <RepMetricCard label="Cost per Review" value="—" hint="Cost data unavailable" icon={DollarSign} />
      </div>

      {showWizard ? (
        <div className={cn(rep.card, "p-4")}>
          <CampaignCreateWizard
            businessId={businessId}
            onCancel={() => setShowWizard(false)}
            onComplete={(campaignId) => {
              setShowWizard(false);
              void load();
              if (campaignId) {
                router.push(`/businesses/${businessId}/reputation/campaigns/${campaignId}`);
              }
            }}
          />
        </div>
      ) : null}

      <section className={cn(rep.card, "overflow-hidden")}>
        <div className="border-b border-[#E6EAF0] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#101828]">Your Campaigns</h2>
              <p className="mt-0.5 text-xs text-[#667085]">Mixed statuses with channel, enrollment, send, and review performance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={rep.select}>
                <option value="all">All Statuses</option>
                {Array.from(new Set(campaigns.map((campaign) => campaign.status))).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={rep.select}>
                <option value="all">All Channels</option>
                {Array.from(new Set(campaigns.map((campaign) => campaign.channel))).map((channel) => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
              <RepSearch value={search} onChange={setSearch} placeholder="Search campaigns..." className="min-w-[240px]" />
            </div>
          </div>
        </div>

        {actionError ? (
          <div className="border-b border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{actionError}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                <th className="px-4 py-2 font-semibold">Campaign</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Channel</th>
                <th className="px-4 py-2 text-right font-semibold">Enrolled</th>
                <th className="px-4 py-2 font-semibold">Messages Sent</th>
                <th className="px-4 py-2 text-right font-semibold">Reviews</th>
                <th className="px-4 py-2 text-right font-semibold">Conversion</th>
                <th className="px-4 py-2 font-semibold">Next Step</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#667085]">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading campaigns...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#667085]">
                    No campaigns match these filters.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const progress = campaign.recipients_ready > 0
                    ? Math.min(100, Math.round(((campaign.sent ?? 0) / campaign.recipients_ready) * 100))
                    : 0;
                  return (
                    <tr key={campaign.id} className="border-b border-[#F2F4F7] last:border-0 hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/businesses/${businessId}/reputation/campaigns/${campaign.id}`}
                          className="font-semibold text-[#101828] hover:text-[#137752] hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-[#667085]">Created {formatDate(campaign.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <RepBadge tone={statusTone(campaign.status)}>{campaign.status}</RepBadge>
                      </td>
                      <td className="px-4 py-3 capitalize text-[#344054]">{campaign.channel}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#344054]">{fmt(campaign.recipients_ready)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums text-[#101828]">{fmt(campaign.sent)}</span>
                          <span className="text-xs text-[#667085]">{progress}%</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
                          <div className="h-full rounded-full bg-[#137752]" style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#344054]">{fmt(campaign.reviews_detected)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#101828]">
                        {pct(campaign.reviews_detected ?? 0, campaign.sent ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-[#344054]">{nextStep(campaign)}</td>
                      <td className="relative px-4 py-3">
                        <button
                          type="button"
                          className={rep.btnSecondary}
                          onClick={() => setMenuId(menuId === campaign.id ? null : campaign.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuId === campaign.id ? (
                          <div className="absolute right-4 z-10 mt-1 w-40 rounded-lg border border-[#E6EAF0] bg-white py-1 shadow-lg">
                            <Link
                              href={`/businesses/${businessId}/reputation/campaigns/${campaign.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-[#344054] hover:bg-[#F9FAFB]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </Link>
                            {campaign.status === "active" ? (
                              <button type="button" onClick={() => void campaignAction(campaign.id, "pause")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                                <Pause className="h-3.5 w-3.5" />
                                Pause
                              </button>
                            ) : null}
                            {campaign.status === "paused" ? (
                              <button type="button" onClick={() => void campaignAction(campaign.id, "resume")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                                <Play className="h-3.5 w-3.5" />
                                Resume
                              </button>
                            ) : null}
                            {campaign.status === "draft" ? (
                              <button type="button" onClick={() => void campaignAction(campaign.id, "start")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                                <Play className="h-3.5 w-3.5" />
                                Start
                              </button>
                            ) : null}
                            <button type="button" onClick={() => void duplicateCampaign(campaign.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#344054] hover:bg-[#F9FAFB]">
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </button>
                            {!["completed", "cancelled", "archived"].includes(campaign.status) ? (
                              <button type="button" onClick={() => void campaignAction(campaign.id, "cancel")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#B42318] hover:bg-[#FEF3F2]">
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CampaignPerformance campaigns={campaigns} />
        <RecentActivity campaigns={campaigns} />
      </div>
    </ModulePage>
  );
}
