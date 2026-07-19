"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, listClass } from "@/components/ui/design-system";
import { CampaignSetupWizard } from "@/components/campaigns/campaign-setup-wizard";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";

type Campaign = { id: string; name: string; description: string | null; schedule_type: string };

export default function BusinessCampaignsPage() {
  const params = useParams();
  const businessId = String(params.businessId ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Group keywords, establish a baseline, and run recurring Maps scans for this location."
        actions={
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className={btnPrimary}
          >
            <Plus className="h-4 w-4" />
            New campaign
          </button>
        }
      />
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {showWizard ? (
        <div className="mb-4">
          <CampaignSetupWizard
            businessId={businessId}
            onClose={() => {
              setShowWizard(false);
              void load();
            }}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : campaigns.length === 0 && !showWizard ? (
        <ModuleEmptyState
          title="No campaigns yet"
          description="Create a campaign to group client keywords, establish a baseline, and run recurring Maps scans — then turn results into a monthly report."
          actionLabel="Create campaign"
          onAction={() => setShowWizard(true)}
        />
      ) : (
        <ul className={listClass}>
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="text-sm font-semibold text-zinc-900 hover:text-[#137752]"
                >
                  {c.name}
                </Link>
                <p className="text-xs capitalize text-zinc-500">{c.schedule_type} schedule</p>
              </div>
              <Link
                href={`/campaigns/${c.id}`}
                className="text-xs font-medium text-[#137752] hover:underline"
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
