"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CampaignSetupWizard,
  MapsCampaignsWizardPageHeader,
  type WizardExistingCampaign,
} from "@/components/campaigns/campaign-setup-wizard";
import { MapsCampaignsList } from "@/components/campaigns/maps-campaigns-list";
import type {
  CampaignListBusiness,
  CampaignListRow,
  CampaignListStats,
} from "@/lib/campaigns/campaign-list-summaries";

const EMPTY_STATS: CampaignListStats = {
  totalKeywords: 0,
  activeCampaigns: 0,
  rankingsUp: 0,
  avgRankPosition: null,
};

export default function BusinessCampaignsPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [business, setBusiness] = useState<CampaignListBusiness | null>(null);
  const [stats, setStats] = useState<CampaignListStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCampaigns(json.campaigns ?? []);
      setBusiness(json.business ?? null);
      setStats(json.stats ?? EMPTY_STATS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const wizardCampaigns: WizardExistingCampaign[] = useMemo(
    () =>
      campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        schedule_type: c.schedule_type,
        keywordCount: c.keywordCount,
        default_grid_size: c.default_grid_size,
        updated_at: c.updated_at ?? null,
        status: c.status ?? "active",
        locationLabel: business?.locationLabel,
      })),
    [campaigns, business?.locationLabel]
  );

  if (showWizard) {
    return (
      <div className="space-y-5">
        <MapsCampaignsWizardPageHeader />
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <CampaignSetupWizard
          businessId={businessId}
          existingCampaigns={wizardCampaigns}
          onClose={() => {
            setShowWizard(false);
            void load();
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#667085]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading campaigns…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <MapsCampaignsList
      businessId={businessId}
      campaigns={campaigns}
      business={business}
      stats={stats}
      onNewCampaign={() => setShowWizard(true)}
    />
  );
}
