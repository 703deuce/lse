"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Upload, UserPlus, FileText } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewRequestsCampaignsTable } from "@/components/reputation/review-requests-campaigns";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import { CampaignBuilder } from "@/components/reputation/campaign-builder";
import { cn } from "@/lib/utils";

type CampaignSummary = {
  id: string;
  status: string;
  sent: number;
  delivered?: number;
  clicked: number;
  opted_out: number;
  reviews_detected?: number | null;
};

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[7.5rem] rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export function ReviewCampaignsHub({ businessId }: { businessId: string }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderTab, setBuilderTab] = useState<"bulk" | "send">("bulk");

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
    return { active, sent, deliveryRate, clickRate, optRate, reviews };
  }, [campaigns]);

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Review Campaigns"
          subtitle="Request honest reviews by SMS and email. Tracking shows delivery and clicks — not guaranteed review attribution."
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setBuilderTab("bulk");
              setShowBuilder(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Campaign
          </button>
          <Link
            href={`/businesses/${businessId}/contacts?import=1`}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Customers
          </Link>
          <Link
            href={`/businesses/${businessId}/contacts`}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Customer
          </Link>
          <Link
            href={`/businesses/${businessId}/review-templates`}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
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
            <MicroStat label="Requests sent" value={String(stats.sent)} />
            <MicroStat label="Delivery rate" value={`${stats.deliveryRate}%`} />
            <MicroStat label="Click rate" value={`${stats.clickRate}%`} />
            <MicroStat label="Opt-out rate" value={`${stats.optRate}%`} />
            <MicroStat label="Likely/confirmed reviews" value={String(stats.reviews)} />
          </>
        )}
      </div>

      <div className="mt-4">
        <ReviewRequestsCampaignsTable businessId={businessId} />
      </div>

      {showBuilder && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">Campaign builder</p>
              <p className="text-[11px] text-zinc-500">
                Details → audience → channel → sequence → content → launch confirmation.
              </p>
            </div>
            <div className="flex gap-1">
              {(
                [
                  ["bulk", "Campaign"],
                  ["send", "Quick Send"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBuilderTab(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-medium",
                    builderTab === id
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setShowBuilder(false);
                  void load();
                }}
                className="text-[12px] font-medium text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
          {builderTab === "bulk" ? (
            <CampaignBuilder
              businessId={businessId}
              onComplete={() => {
                setShowBuilder(false);
                void load();
              }}
            />
          ) : (
            <ReviewRequestsPanel businessId={businessId} section="send" hideSubTabs />
          )}
        </div>
      )}
    </ModulePage>
  );
}
