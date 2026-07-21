"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  Plus,
} from "lucide-react";
import {
  PageHeader,
  ModulePage,
  ModuleSkeleton,
  MetricStrip,
  btnGhost,
  btnPrimary,
  listClass,
} from "@/components/ui/design-system";
import { CampaignSetupWizard } from "@/components/campaigns/campaign-setup-wizard";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { ClientPager } from "@/components/ui/show-more-list";
import { cn } from "@/lib/utils";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_enabled?: boolean | null;
  keyword_count?: number | null;
};

const PAGE_SIZE = 15;

export default function BusinessCampaignsPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [page, setPage] = useState(1);

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

  const scheduled = campaigns.filter(
    (c) => c.schedule_enabled || (c.schedule_type && c.schedule_type !== "manual")
  ).length;

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return campaigns.slice(start, start + PAGE_SIZE);
  }, [campaigns, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [campaigns.length, page]);

  return (
    <ModulePage>
      <PageHeader
        title="Maps Campaigns"
        description="Group keywords into recurring Maps scans and turn ranking progress into client-ready reports."
        primaryAction={
          <button type="button" onClick={() => setShowWizard(true)} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            Create campaign
          </button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {showWizard ? (
        <CampaignSetupWizard
          businessId={businessId}
          onClose={() => {
            setShowWizard(false);
            void load();
          }}
        />
      ) : null}

      {loading ? (
        <ModuleSkeleton rows={4} />
      ) : campaigns.length === 0 && !showWizard ? (
        <ModuleEmptyState
          icon={FolderKanban}
          title="No campaigns yet"
          description="Create a campaign to group client keywords, establish a baseline, and run recurring Maps scans — then turn results into a monthly report."
          actionLabel="Create campaign"
          onAction={() => setShowWizard(true)}
        />
      ) : campaigns.length > 0 ? (
        <div className="space-y-4">
          <MetricStrip
            items={[
              { label: "Campaigns", value: String(campaigns.length) },
              { label: "Scheduled", value: String(scheduled) },
              {
                label: "Manual",
                value: String(campaigns.length - scheduled),
              },
            ]}
          />
          <ul className={listClass}>
            {pageItems.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3.5 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <FolderKanban className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-sm font-semibold text-zinc-900 hover:text-[#137752]"
                    >
                      {c.name}
                    </Link>
                    {c.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{c.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-zinc-500">
                      <span className="capitalize">{c.schedule_type || "manual"}</span>
                      {c.keyword_count != null ? ` · ${c.keyword_count} keywords` : ""}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/campaigns/${c.id}`}
                  className={cn(btnGhost, "h-8 shrink-0 px-2.5 text-xs")}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>

          <ClientPager
            page={page}
            pageSize={PAGE_SIZE}
            total={campaigns.length}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </ModulePage>
  );
}
