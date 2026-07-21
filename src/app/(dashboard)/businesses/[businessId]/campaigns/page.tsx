"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  Plus,
} from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  ModuleSkeleton,
  btnPrimary,
  btnSecondary,
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
      <ModuleHeader
        icon={FolderKanban}
        title="Maps Campaigns"
        actions={
          <button type="button" onClick={() => setShowWizard(true)} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            New campaign
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
        <div className="space-y-3">
          <p className="text-[12px] text-zinc-500">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
            {scheduled ? ` · ${scheduled} scheduled` : ""}
          </p>
          <ul className={listClass}>
            {pageItems.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                    <FolderKanban className="h-4 w-4" />
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
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-600 ring-1 ring-inset ring-zinc-200/80">
                        {c.schedule_type || "manual"} schedule
                      </span>
                      {c.keyword_count != null ? (
                        <span className="inline-flex rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200/80">
                          {c.keyword_count} keywords
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/campaigns/${c.id}`}
                  className={cn(btnSecondary, "h-8 shrink-0 px-3 text-xs")}
                >
                  Open campaign
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
