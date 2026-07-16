"use client";

import { useEffect, useState } from "react";
import { ContentCard } from "@/components/ui/design-system";

type UsageResponse = {
  organization: { name: string; plan: string; billing_status: string | null } | null;
  plan: {
    name: string;
    priceLabel: string;
    limits: Record<string, number>;
  };
  usage: Record<string, number>;
  businessCount: number;
  webhookEndpoints?: number;
  webhookEventsMonth?: number;
};

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-700">{label}</span>
        <span className="font-medium text-zinc-900">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AccountPlanUsageCard() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    fetch("/api/account/usage", { signal: ctrl.signal })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error ?? "Failed to load usage");
        return json as UsageResponse;
      })
      .then(setData)
      .catch((e) => {
        if (ctrl.signal.aborted) setError("Plan usage timed out — refresh the page");
        else setError(e instanceof Error ? e.message : "Failed to load usage");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  if (error) {
    return (
      <ContentCard>
        <p className="text-sm text-red-600">{error}</p>
      </ContentCard>
    );
  }

  if (!data) {
    return (
      <ContentCard>
        <p className="text-sm text-zinc-500">Loading plan usage…</p>
      </ContentCard>
    );
  }

  const { plan, usage } = data;

  return (
    <ContentCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Account & Plan</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {data.organization?.name ?? "Workspace"} · {plan.name} ({plan.priceLabel})
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          Billing: {data.organization?.billing_status ?? "manual"}
        </span>
      </div>

      <div className="space-y-4">
        <UsageRow label="Businesses" used={data.businessCount} limit={plan.limits.max_businesses} />
        <UsageRow label="Map credits" used={usage.map_credits_used} limit={plan.limits.map_credits_month} />
        <UsageRow label="Growth audits" used={usage.growth_audits_used} limit={plan.limits.growth_audits_month} />
        <UsageRow label="Local Trust scans" used={usage.local_trust_scans_used} limit={plan.limits.local_trust_scans_month} />
        <UsageRow label="Backlink Gap runs" used={usage.backlink_gap_runs_used} limit={plan.limits.backlink_gap_runs_month} />
        <UsageRow label="Review emails" used={usage.review_emails_sent} limit={plan.limits.email_review_requests_month} />
        <UsageRow label="SMS messages" used={usage.review_sms_sent} limit={plan.limits.sms_month} />
        <UsageRow label="Bulk review requests" used={usage.bulk_review_requests_used} limit={plan.limits.bulk_review_requests_month} />
        <UsageRow
          label="Review trigger endpoints"
          used={data.webhookEndpoints ?? 0}
          limit={plan.limits.webhook_endpoints ?? 0}
        />
        <UsageRow
          label="Review trigger events"
          used={data.webhookEventsMonth ?? 0}
          limit={plan.limits.webhook_events_month ?? 0}
        />
      </div>
    </ContentCard>
  );
}
