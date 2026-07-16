"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Plus, Webhook } from "lucide-react";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type EndpointRow = {
  id: string;
  name: string;
  businessId: string | null;
  campaignId: string | null;
  eventType: string;
  isTest: boolean;
  isActive: boolean;
  tokenLastFour: string;
  lastReceivedAt: string | null;
  createdAt: string;
};

type CampaignOpt = { id: string; name: string; status: string };

type Metrics = {
  active: number;
  eventsThisMonth: number;
  successful: number;
  failed: number;
};

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[calc(50%-0.25rem)] flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 sm:min-w-[6.5rem] sm:flex-none">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}

export function WebhooksClient({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Job completed → Review campaign");
  const [campaignId, setCampaignId] = useState("");
  const [eventType, setEventType] = useState("service.completed");
  const [isTest, setIsTest] = useState(true);
  const [delayMinutes, setDelayMinutes] = useState(120);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wh, camps] = await Promise.all([
        fetch(`/api/integrations/webhooks?businessId=${businessId}`),
        fetch(`/api/reputation/review-requests/campaigns?businessId=${businessId}`),
      ]);
      const whJson = await wh.json();
      const campJson = await camps.json();
      if (!wh.ok) throw new Error(whJson.error || "Failed to load webhooks");
      setEndpoints(whJson.endpoints ?? []);
      setMetrics(whJson.metrics ?? null);
      const list = (campJson.campaigns ?? []) as Array<{ id: string; name: string; status: string }>;
      setCampaigns(list.filter((c) => ["active", "scheduled", "paused", "draft"].includes(c.status)));
      setCampaignId((prev) => prev || list[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEndpoint() {
    setCreating(true);
    setError(null);
    setCreatedUrl(null);
    setCreatedSecret(null);
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          campaignId,
          name,
          eventType,
          isTest,
          sendDelayMinutes: delayMinutes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setCreatedUrl(json.webhookUrl);
      setCreatedSecret(json.signingSecret ?? null);
      setShowCreate(false);
      await load();
      if (json.endpoint?.id) void openDetail(json.endpoint.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/webhooks/${id}?businessId=${businessId}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setDetail(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function patchAction(id: string, action?: string, extra?: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/webhooks/${id}?businessId=${businessId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action ? { action, ...extra } : { ...extra }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      if (json.webhookUrl) setCreatedUrl(json.webhookUrl);
      if (json.signingSecret) setCreatedSecret(json.signingSecret);
      await load();
      await openDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  const endpoint = detail?.endpoint as Record<string, unknown> | undefined;
  const events = (detail?.events as Array<Record<string, unknown>>) ?? [];
  const sample = detail?.samplePayload as Record<string, unknown> | undefined;

  return (
    <ModulePage>
      <ModuleHeader
        title="Automatic Review Triggers"
        subtitle="When a job, invoice, or appointment completes in your CRM, enroll the customer in a Review Campaign — via Zapier, Make, n8n, or custom HTTP."
        icon={Webhook}
        actions={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" /> New webhook
          </button>
        }
      />

      {metrics ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <MicroStat label="Active" value={String(metrics.active)} />
          <MicroStat label="Events (mo)" value={String(metrics.eventsThisMonth)} />
          <MicroStat label="Successful" value={String(metrics.successful)} />
          <MicroStat label="Failed" value={String(metrics.failed)} />
        </div>
      ) : null}

      {createdUrl ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px]">
          <p className="font-semibold text-amber-900">Copy your webhook URL now</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all text-amber-950">{createdUrl}</code>
            <button type="button" onClick={() => void copy(createdUrl)} className="rounded border border-amber-300 bg-white p-1">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {createdSecret ? (
            <p className="mt-1 break-all text-amber-900">
              Signing secret: <code>{createdSecret}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-2 text-[12px] text-red-600">{error}</p> : null}

      {showCreate ? (
        <div className="mb-3 rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-[13px] font-semibold text-zinc-900">Create webhook</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-[12px] sm:col-span-2">
              <span className="text-zinc-500">Name</span>
              <input
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-[12px]">
              <span className="text-zinc-500">Campaign</span>
              <select
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px]">
              <span className="text-zinc-500">Event type</span>
              <select
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="service.completed">service.completed</option>
                <option value="appointment.completed">appointment.completed</option>
                <option value="invoice.paid">invoice.paid</option>
                <option value="order.fulfilled">order.fulfilled</option>
                <option value="contact.enroll">contact.enroll</option>
              </select>
            </label>
            <label className="block text-[12px]">
              <span className="text-zinc-500">Delay (minutes)</span>
              <input
                type="number"
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-[13px]"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-2 pt-5 text-[12px] text-zinc-700">
              <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
              Start in test mode (no real sends)
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={creating || !campaignId}
              onClick={() => void createEndpoint()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create & copy URL"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-[12px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-[12px]">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Name</th>
              <th className="px-2.5 py-1.5 font-medium">Event</th>
              <th className="px-2.5 py-1.5 font-medium">Env</th>
              <th className="px-2.5 py-1.5 font-medium">Status</th>
              <th className="px-2.5 py-1.5 font-medium">Last received</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-2.5 py-4 text-zinc-500">
                  <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading…
                </td>
              </tr>
            ) : endpoints.length ? (
              endpoints.map((e) => (
                <tr
                  key={e.id}
                  className={cn(
                    "cursor-pointer border-b border-zinc-50 hover:bg-zinc-50",
                    selectedId === e.id && "bg-zinc-50"
                  )}
                  onClick={() => void openDetail(e.id)}
                >
                  <td className="px-2.5 py-2 font-medium text-zinc-900">
                    <span className="inline-flex items-center gap-1">
                      <Webhook className="h-3 w-3 text-zinc-400" />
                      {e.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-zinc-400">
                      …{e.tokenLastFour}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-zinc-600">{e.eventType}</td>
                  <td className="px-2.5 py-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        e.isTest ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                      )}
                    >
                      {e.isTest ? "Test" : "Live"}
                    </span>
                  </td>
                  <td className="px-2.5 py-2">
                    {e.isActive ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-zinc-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-zinc-500">
                    {e.lastReceivedAt
                      ? new Date(e.lastReceivedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-2.5 py-6 text-center text-zinc-500">
                  No webhooks yet. Create one to connect Jobber, Stripe, Zapier, Make, or n8n.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
          {detailLoading || !endpoint ? (
            <p className="text-[12px] text-zinc-500">
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading detail…
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold text-zinc-900">
                    {String(endpoint.name)}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {endpoint.isTest ? "Test" : "Live"} ·{" "}
                    {endpoint.isActive ? "Active" : "Disabled"} ·{" "}
                    {String(endpoint.eventType)} · delay{" "}
                    {String(endpoint.sendDelayMinutes)}m
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    URL ends with …{String(endpoint.tokenLastFour)} (rotate to get a new full URL)
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px]"
                    onClick={() =>
                      void patchAction(selectedId, undefined, {
                        isTest: !endpoint.isTest,
                      })
                    }
                  >
                    {endpoint.isTest ? "Promote to live" : "Switch to test"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px]"
                    onClick={() =>
                      void patchAction(selectedId, undefined, {
                        isActive: !endpoint.isActive,
                      })
                    }
                  >
                    {endpoint.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px]"
                    onClick={() => void patchAction(selectedId, "rotate_url")}
                  >
                    Rotate URL
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700"
                    onClick={() => {
                      if (confirm("Revoke this endpoint permanently?")) {
                        void patchAction(selectedId, "revoke");
                        setSelectedId(null);
                        setDetail(null);
                      }
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">
                    Sample payload
                  </p>
                  <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-100 bg-zinc-50 p-2 text-[10px] text-zinc-700">
                    {JSON.stringify(sample, null, 2)}
                  </pre>
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-zinc-600 underline"
                    onClick={() => void copy(JSON.stringify(sample, null, 2))}
                  >
                    Copy sample JSON
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-zinc-500">
                    Zapier / Make / n8n
                  </p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-zinc-600">
                    <li>Trigger: job/invoice/appointment completed</li>
                    <li>Action: HTTP POST (Webhooks by Zapier / Make HTTP / n8n HTTP Request)</li>
                    <li>Paste your unique webhook URL</li>
                    <li>Content-Type: application/json</li>
                    <li>Map event_id, customer name/email/phone</li>
                    <li>Test — confirm event appears below</li>
                    <li>Promote endpoint to live when ready</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Full docs in the repo: docs/INCOMING_WEBHOOKS.md
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase text-zinc-500">
                  Recent events
                </p>
                <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto text-[11px]">
                  {events.length ? (
                    events.map((ev) => {
                      const norm = (ev.payload_normalized ?? {}) as {
                        customer?: { name?: string; email?: string; phone?: string };
                      };
                      const customer =
                        norm.customer?.name ||
                        norm.customer?.email ||
                        norm.customer?.phone ||
                        "—";
                      return (
                        <li
                          key={String(ev.id)}
                          className="rounded border border-zinc-100 px-2 py-1.5"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-zinc-800">
                              {String(ev.event_type)} · {String(ev.status)}
                            </span>
                            <span className="text-zinc-400">
                              {ev.received_at
                                ? new Date(String(ev.received_at)).toLocaleString()
                                : ""}
                            </span>
                          </div>
                          <p className="text-zinc-600">
                            {customer}
                            {ev.external_event_id
                              ? ` · ${String(ev.external_event_id)}`
                              : ""}
                          </p>
                          {ev.customer_safe_error ? (
                            <p className="text-amber-700">{String(ev.customer_safe_error)}</p>
                          ) : null}
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-zinc-400">No events yet. Send a test POST from Zapier.</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </ModulePage>
  );
}
