"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react";

type KeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  businessId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export function AutomationApiKeysCard({ businessId }: { businessId: string }) {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Zapier / Make");
  const [scopeToBusiness, setScopeToBusiness] = useState(true);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/api-keys?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load keys");
      setKeys(json.keys ?? []);
      setWebhookUrl(json.webhookUrl ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    setCreating(true);
    setError(null);
    setRawKey(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, name, scopeToBusiness }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create key");
      setRawKey(json.rawKey);
      setWebhookUrl(json.webhookUrl ?? webhookUrl);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(keyId: string) {
    if (!confirm("Revoke this API key? Zapier/Make zaps using it will stop working.")) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/settings/api-keys?businessId=${businessId}&keyId=${keyId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to revoke");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 h-4 w-4 text-zinc-500" />
        <div>
          <h2 className="font-semibold">Automations (Zapier / Make)</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            One webhook surface for Jobber, Housecall Pro, Stripe, Facebook Leads, and thousands of
            other apps — without building each native integration.
          </p>
        </div>
      </div>

      {webhookUrl ? (
        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Webhook URL
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-[12px] text-zinc-800">{webhookUrl}</code>
            <button
              type="button"
              onClick={() => void copy(webhookUrl)}
              className="rounded border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50"
              title="Copy URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {rawKey ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-900">
            Copy your API key now — it won&apos;t be shown again
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all text-[12px] text-amber-950">{rawKey}</code>
            <button
              type="button"
              onClick={() => void copy(rawKey)}
              className="rounded border border-amber-300 bg-white p-1.5 text-amber-800"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {copied ? <p className="mt-1 text-[11px] text-amber-800">Copied</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block text-sm">
          <span className="text-zinc-500">Key name</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Zapier production"
          />
        </label>
        <button
          type="button"
          onClick={() => void createKey()}
          disabled={creating}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create API key"}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
        <input
          type="checkbox"
          checked={scopeToBusiness}
          onChange={(e) => setScopeToBusiness(e.target.checked)}
        />
        Limit this key to the current business only
      </label>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Active keys
        </p>
        {loading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : keys.length ? (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{k.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {k.keyPrefix}… · {k.businessId ? "this business" : "all businesses"}
                    {k.lastUsedAt
                      ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : " · never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revoke(k.id)}
                  className="rounded border border-zinc-200 p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  title="Revoke"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No API keys yet.</p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[12px] leading-relaxed text-zinc-600">
        <p className="font-medium text-zinc-800">Zapier / Make setup</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>Trigger: Jobber job completed, Stripe invoice paid, etc.</li>
          <li>
            Action: <strong>Webhooks by Zapier → POST</strong> to the URL above
          </li>
          <li>
            Header <code className="text-[11px]">Authorization: Bearer YOUR_KEY</code>
          </li>
          <li>
            Body JSON with <code className="text-[11px]">action</code>:{" "}
            <code className="text-[11px]">enroll_campaign</code> or{" "}
            <code className="text-[11px]">send_review_request</code>
          </li>
        </ol>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
