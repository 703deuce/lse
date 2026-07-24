"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Code2, Loader2, PlugZap, Webhook } from "lucide-react";
import { WebhooksClient } from "@/components/integrations/webhooks-client";
import { ModulePage, TabBar } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";

type AutomationTab = "triggers" | "integrations" | "activity";

const AUTOMATION_TABS: Array<{ id: AutomationTab; label: string }> = [
  { id: "triggers", label: "Triggers" },
  { id: "integrations", label: "Integrations" },
  { id: "activity", label: "Activity Log" },
];

type EndpointRow = {
  id: string;
  name: string;
  eventType: string;
  isActive: boolean;
  isTest: boolean;
  lastReceivedAt: string | null;
};

type WebhookEvent = {
  id: string;
  endpointName: string;
  event_type: string;
  status: string;
  received_at: string | null;
  processed_at?: string | null;
  external_event_id?: string | null;
  customer_safe_error?: string | null;
};

function IntegrationCard({
  icon: Icon,
  title,
  description,
  detail,
}: {
  icon: typeof PlugZap;
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-50 p-2 text-[#137752]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-[12px] leading-snug text-zinc-500">{description}</p>
          <p className="mt-3 rounded-md bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <IntegrationCard
        icon={PlugZap}
        title="Zapier"
        description="Use Webhooks by Zapier to POST completed job, appointment, invoice, or order events."
        detail="Create a trigger, copy the webhook URL, then test before promoting to live."
      />
      <IntegrationCard
        icon={Webhook}
        title="Generic webhook"
        description="Connect Make, n8n, CRMs, schedulers, and field-service tools with a JSON POST."
        detail="Supports field mapping, test mode, duplicate windows, and optional signatures."
      />
      <IntegrationCard
        icon={Code2}
        title="API"
        description="Send server-side automation events from your own backend or middleware."
        detail="Use the trigger URL and map customer identity fields for enrollment."
      />
    </div>
  );
}

function ActivityLogTab({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/webhooks?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load automations");
      const endpointRows = (json.endpoints ?? []) as EndpointRow[];
      setEndpoints(endpointRows);
      const details = await Promise.all(
        endpointRows.slice(0, 8).map(async (endpoint) => {
          const detailRes = await fetch(
            `/api/integrations/webhooks/${endpoint.id}?businessId=${businessId}`
          );
          if (!detailRes.ok) return [];
          const detailJson = await detailRes.json();
          return ((detailJson.events ?? []) as Array<Record<string, unknown>>).map((event) => ({
            id: String(event.id),
            endpointName: endpoint.name,
            event_type: String(event.event_type ?? endpoint.eventType),
            status: String(event.status ?? "unknown"),
            received_at: event.received_at ? String(event.received_at) : null,
            processed_at: event.processed_at ? String(event.processed_at) : null,
            external_event_id: event.external_event_id ? String(event.external_event_id) : null,
            customer_safe_error: event.customer_safe_error
              ? String(event.customer_safe_error)
              : null,
          }));
        })
      );
      setEvents(
        details
          .flat()
          .sort((a, b) => String(b.received_at ?? "").localeCompare(String(a.received_at ?? "")))
          .slice(0, 50)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load automations");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const endpointCopy = useMemo(() => {
    if (!endpoints.length) return "No triggers exist yet, so there are no webhook events to show.";
    return "Showing recent webhook events from the first loaded triggers.";
  }, [endpoints.length]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
      </div>
    );
  }

  if (error) {
    return <p className="text-[12px] text-red-600">{error}</p>;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-zinc-900">Webhook activity</h3>
        <p className="text-[11px] text-zinc-500">{endpointCopy}</p>
      </div>
      {events.length ? (
        <ul className="divide-y divide-zinc-100">
          {events.map((event) => (
            <li key={`${event.endpointName}-${event.id}`} className="px-3.5 py-2.5 text-[12px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-900">
                  {event.event_type} · {event.status}
                </p>
                <span className="text-[11px] text-zinc-400">
                  {event.received_at ? new Date(event.received_at).toLocaleString() : "—"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {event.endpointName}
                {event.external_event_id ? ` · ${event.external_event_id}` : ""}
              </p>
              {event.customer_safe_error ? (
                <p className="mt-1 text-[11px] text-amber-700">{event.customer_safe_error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-center text-[13px] text-zinc-500">
          {endpoints.length
            ? "No webhook events yet. Send a test POST from Zapier, Make, n8n, or your API."
            : "No triggers yet. Create a trigger before activity appears here."}
        </div>
      )}
    </div>
  );
}

export function AutomationsHub({ businessId }: { businessId: string }) {
  const [activeTab, setActiveTab] = useState<AutomationTab>("triggers");

  return (
    <ModulePage>
      <PageHeader
        title="Automations"
        subtitle="Create triggers, connect integrations, and monitor webhook activity for review campaign enrollment."
      />
      <TabBar tabs={AUTOMATION_TABS} active={activeTab} onChange={setActiveTab} />
      <div className="mt-3">
        {activeTab === "triggers" ? <WebhooksClient businessId={businessId} embedded /> : null}
        {activeTab === "integrations" ? <IntegrationsTab /> : null}
        {activeTab === "activity" ? <ActivityLogTab businessId={businessId} /> : null}
      </div>
    </ModulePage>
  );
}
