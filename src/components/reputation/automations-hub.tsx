"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Code2,
  History,
  MoreHorizontal,
  PlugZap,
  Plus,
  Settings,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { WebhooksClient } from "@/components/integrations/webhooks-client";
import { RepBadge, RepMetricCard, RepPageHeader, RepTabs, rep } from "@/components/reputation/rep-ui";
import type { ReputationAutomationPreviewData } from "@/lib/reputation/reputation-page-preview-data";
import { cn } from "@/lib/utils";

type AutomationTab = "triggers" | "integrations" | "activity" | "history";

type EndpointRow = {
  id: string;
  name: string;
  eventType: string;
  isActive: boolean;
  isTest: boolean;
  lastReceivedAt: string | null;
  campaignId?: string | null;
};

type Metrics = {
  active?: number;
  eventsThisMonth?: number;
  successful?: number;
  failed?: number;
};

type TriggerRow = ReputationAutomationPreviewData["triggers"][number];
type ActivityRow = ReputationAutomationPreviewData["activities"][number];
type IntegrationRow = ReputationAutomationPreviewData["integrations"][number];

const TABS: Array<{ id: AutomationTab; label: string }> = [
  { id: "triggers", label: "Triggers" },
  { id: "integrations", label: "Integrations" },
  { id: "activity", label: "Activity Log" },
  { id: "history", label: "Workflow History" },
];

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusTone(status: TriggerRow["status"]): "green" | "amber" | "gray" {
  if (status === "Active") return "green";
  if (status === "Test") return "amber";
  return "gray";
}

function IntegrationCard({ item, icon: Icon }: { item: IntegrationRow; icon: typeof PlugZap }) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[#101828]">{item.name}</h3>
            <RepBadge tone={item.status === "Connected" ? "green" : "gray"}>{item.status}</RepBadge>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[#667085]">{item.detail}</p>
          <button type="button" className={cn(rep.btnSecondary, "mt-4")}>
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#101828]">Recent Activity</h2>
        <Activity className="h-4 w-4 text-[#98A2B3]" />
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3">
            <span
              className={cn(
                "mt-1 h-2.5 w-2.5 rounded-full",
                row.tone === "red" ? "bg-[#D92D20]" : row.tone === "amber" ? "bg-[#F79009]" : "bg-[#137752]"
              )}
            />
            <div>
              <p className="text-sm font-medium text-[#101828]">{row.title}</p>
              <p className="text-xs text-[#667085]">{row.detail}</p>
              <p className="mt-1 text-xs text-[#98A2B3]">{row.at}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectedIntegrations({ rows }: { rows: IntegrationRow[] }) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <h2 className="text-sm font-semibold text-[#101828]">Connected Integrations</h2>
      <div className="mt-3 space-y-2">
        {rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2">
            <div>
              <p className="text-sm font-medium text-[#101828]">{item.name}</p>
              <p className="text-xs text-[#667085]">{item.detail}</p>
            </div>
            <RepBadge tone={item.status === "Connected" ? "green" : "gray"}>{item.status}</RepBadge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AutomationsHub({
  businessId,
  previewData,
}: {
  businessId: string;
  previewData?: ReputationAutomationPreviewData;
}) {
  const [activeTab, setActiveTab] = useState<AutomationTab>("triggers");
  const [triggers, setTriggers] = useState<TriggerRow[]>(previewData?.triggers ?? []);
  const [metrics, setMetrics] = useState(previewData?.metrics ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/webhooks?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load automations");
      const endpointRows = (json.endpoints ?? []) as EndpointRow[];
      const apiMetrics = (json.metrics ?? {}) as Metrics;
      setTriggers(
        endpointRows.map((endpoint) => ({
          id: endpoint.id,
          name: endpoint.name,
          source: endpoint.eventType,
          campaign: endpoint.campaignId ? `Campaign ${endpoint.campaignId.slice(0, 8)}` : "Mapped campaign",
          status: endpoint.isTest ? "Test" : endpoint.isActive ? "Active" : "Paused",
          lastFired: endpoint.lastReceivedAt,
          enrolled: 0,
        }))
      );
      const successful = Number(apiMetrics.successful ?? 0);
      const failed = Number(apiMetrics.failed ?? 0);
      const total = successful + failed;
      setMetrics({
        active: Number(apiMetrics.active ?? endpointRows.filter((endpoint) => endpoint.isActive).length),
        fired30d: Number(apiMetrics.eventsThisMonth ?? 0),
        enrolled: successful,
        reviewsGenerated: Math.round(successful * 0.12),
        successPct: total > 0 ? Math.round((successful / total) * 1000) / 10 : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, previewData]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const fallbackActivities = useMemo<ActivityRow[]>(
    () =>
      triggers.slice(0, 3).map((trigger, index) => ({
        id: `activity-${trigger.id}`,
        title: trigger.lastFired ? `${trigger.name} fired` : `${trigger.name} ready`,
        detail: trigger.campaign,
        at: trigger.lastFired ? fmtDateTime(trigger.lastFired) : index === 0 ? "No events yet" : "Waiting for webhook",
        tone: trigger.status === "Active" ? "green" : "amber",
      })),
    [triggers]
  );
  const activities = previewData?.activities ?? fallbackActivities;
  const integrations: IntegrationRow[] =
    previewData?.integrations ??
    [
      { id: "zapier", name: "Zapier", status: "Available", detail: "Use Webhooks by Zapier to POST completed jobs." },
      { id: "generic", name: "Generic webhook", status: triggers.length ? "Connected" : "Available", detail: "Connect Make, n8n, CRMs, schedulers, and field-service tools." },
      { id: "api", name: "API", status: "Available", detail: "Send automation events from your backend." },
    ];
  const safeMetrics =
    metrics ??
    {
      active: triggers.filter((trigger) => trigger.status === "Active").length,
      fired30d: 0,
      enrolled: 0,
      reviewsGenerated: 0,
      successPct: 0,
    };

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Automations"
        subtitle="Connect your tools and automate review request workflows."
        showCompare={false}
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button type="button" className={rep.btnPrimary}>
              <Plus className="h-4 w-4" />
              New Automation
            </button>
            <button type="button" className={rep.btnSecondary}>
              <PlugZap className="h-4 w-4" />
              Integrations
            </button>
            <button type="button" className={rep.btnSecondary}>
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <RepMetricCard label="Active Automations" value={safeMetrics.active} icon={Zap} hint="Live triggers" />
        <RepMetricCard label="Triggers Fired 30d" value={safeMetrics.fired30d.toLocaleString()} icon={Activity} hint="Webhook events" />
        <RepMetricCard label="Contacts Enrolled" value={safeMetrics.enrolled.toLocaleString()} icon={Users} hint="From automations" />
        <RepMetricCard label="Reviews Generated" value={safeMetrics.reviewsGenerated.toLocaleString()} icon={CheckCircle2} hint="Estimated/attributed" />
        <RepMetricCard label="Automation Success" value={`${safeMetrics.successPct}%`} icon={Webhook} hint="Processed events" />
      </div>

      <RepTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as AutomationTab)} />

      {activeTab === "triggers" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div className={cn(rep.card, "overflow-hidden")}>
              <div className="border-b border-[#E6EAF0] px-4 py-3">
                <h2 className="text-sm font-semibold text-[#101828]">Trigger workflows</h2>
                <p className="text-xs text-[#667085]">Webhook and integration events mapped into review campaigns.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#667085]">
                    <tr>
                      <th className="min-w-[260px] px-4 py-3 font-semibold">Trigger</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Campaign</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Last Fired</th>
                      <th className="px-4 py-3 text-right font-semibold">Enrolled</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F6]">
                    {triggers.map((trigger) => (
                      <tr key={trigger.id} className="bg-white hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#101828]">{trigger.name}</p>
                          <p className="text-xs text-[#667085]">{trigger.id}</p>
                        </td>
                        <td className="px-4 py-3 text-[#344054]">{trigger.source}</td>
                        <td className="px-4 py-3 text-[#344054]">{trigger.campaign}</td>
                        <td className="px-4 py-3">
                          <RepBadge tone={statusTone(trigger.status)}>{trigger.status}</RepBadge>
                        </td>
                        <td className="px-4 py-3 text-[#667085]">{fmtDateTime(trigger.lastFired)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#344054]">{trigger.enrolled.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <button type="button" className="rounded-lg p-1.5 text-[#98A2B3] hover:bg-[#F2F4F7]">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && triggers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#667085]">
                          No triggers yet. Create a webhook automation to enroll contacts automatically.
                        </td>
                      </tr>
                    ) : null}
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#667085]">
                          Loading automations...
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
            {!previewData ? (
              <div className={cn(rep.card, "p-4")}>
                <WebhooksClient businessId={businessId} embedded />
              </div>
            ) : null}
          </div>

          <aside className="space-y-3">
            <ActivityFeed rows={activities} />
            <ConnectedIntegrations rows={integrations} />
          </aside>
        </div>
      ) : null}

      {activeTab === "integrations" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <IntegrationCard item={integrations[0] ?? { id: "zapier", name: "Zapier", status: "Available", detail: "Create a trigger and copy the webhook URL." }} icon={PlugZap} />
          <IntegrationCard item={integrations[1] ?? { id: "webhook", name: "Generic webhook", status: "Available", detail: "POST mapped JSON from any system." }} icon={Webhook} />
          <IntegrationCard item={integrations[2] ?? { id: "api", name: "API", status: "Available", detail: "Server-side automation events." }} icon={Code2} />
        </div>
      ) : null}

      {activeTab === "activity" ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ActivityFeed rows={activities} />
          <ConnectedIntegrations rows={integrations} />
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className={cn(rep.card, "p-4")}>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#137752]" />
            <h2 className="text-sm font-semibold text-[#101828]">Workflow History</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {triggers.slice(0, 3).map((trigger) => (
              <div key={trigger.id} className="rounded-xl bg-[#F9FAFB] p-3">
                <p className="text-sm font-semibold text-[#101828]">{trigger.name}</p>
                <p className="mt-1 text-xs text-[#667085]">
                  Last run {fmtDateTime(trigger.lastFired)} · {trigger.enrolled.toLocaleString()} enrolled
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
