"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Upload, UserPlus, FileText } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewRequestsCampaignsTable } from "@/components/reputation/review-requests-campaigns";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import { CampaignCreateWizard } from "@/components/reputation/campaign-create-wizard";
import { cn } from "@/lib/utils";

type CampaignSummary = {
  id: string;
  status: string;
  sent: number;
  delivered?: number;
  clicked: number;
  opted_out: number;
  reviews_detected?: number | null;
  trigger_type?: string;
};

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[calc(50%-0.25rem)] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 sm:min-w-[7.5rem] sm:flex-none">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export function ReviewCampaignsHub({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

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
            href={`/businesses/${businessId}/contacts?import=1`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:flex-none"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Customers
          </Link>
          <Link
            href={`/businesses/${businessId}/contacts`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:flex-none"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Customer
          </Link>
          <Link
            href={`/businesses/${businessId}/review-templates`}
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
                router.push(`/businesses/${businessId}/review-campaigns/${campaignId}`);
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

      <div className="mt-4">
        <ReviewRequestsCampaignsTable businessId={businessId} refreshKey={tableRefreshKey} />
      </div>
    </ModulePage>
  );
}
