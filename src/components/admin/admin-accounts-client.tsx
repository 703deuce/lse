"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContentCard } from "@/components/ui/design-system";
import type { PlanId } from "@/lib/plans";

type AdminAccount = {
  id: string;
  name: string;
  plan: string;
  ownerEmail: string | null;
  outbound_paused?: boolean;
  usage: Record<string, number>;
};

const PLAN_OPTIONS: { id: PlanId; label: string }[] = [
  { id: "starter", label: "starter (5 locations)" },
  { id: "pro", label: "pro (10 locations)" },
  { id: "agency", label: "agency (20 locations)" },
  { id: "internal", label: "internal (unlimited — testing)" },
];

export function AdminAccountsClient() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/accounts");
    if (!res.ok) {
      setError("Failed to load accounts");
      return;
    }
    const json = await res.json();
    setAccounts(json.accounts ?? []);
  }

  useEffect(() => {
    load().catch(() => setError("Failed to load accounts"));
  }, []);

  async function updatePlan(accountId: string, planId: PlanId) {
    setSavingId(accountId);
    const res = await fetch(`/api/admin/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    setSavingId(null);
    if (!res.ok) {
      setError("Failed to update plan");
      return;
    }
    await load();
  }

  async function resetUsage(accountId: string) {
    setSavingId(accountId);
    const res = await fetch(`/api/admin/accounts/${accountId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-usage" }),
    });
    setSavingId(null);
    if (!res.ok) {
      setError("Failed to reset usage");
      return;
    }
    await load();
  }

  async function toggleOutbound(accountId: string, pause: boolean) {
    setSavingId(accountId);
    const res = await fetch(`/api/admin/accounts/${accountId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: pause ? "pause-outbound" : "resume-outbound" }),
    });
    setSavingId(null);
    if (!res.ok) {
      setError("Failed to update outbound pause");
      return;
    }
    await load();
  }

  if (error) {
    return <ContentCard><p className="text-sm text-red-600">{error}</p></ContentCard>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/ops" className="text-emerald-700 underline">
          Ops console
        </Link>{" "}
        — queues, Redis, job retry/cancel. To test multi-location yourself, set your org plan to{" "}
        <strong className="font-medium text-zinc-700">agency</strong> (20 locations) or{" "}
        <strong className="font-medium text-zinc-700">internal</strong> (unlimited).
      </p>
      {accounts.map((account) => (
        <ContentCard key={account.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{account.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">{account.ownerEmail ?? "No owner email"}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Map credits: {account.usage.map_credits_used ?? 0} · Growth audits: {account.usage.growth_audits_used ?? 0}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={account.plan}
                onChange={(e) => updatePlan(account.id, e.target.value as PlanId)}
                disabled={savingId === account.id}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => resetUsage(account.id)}
                disabled={savingId === account.id}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Reset usage
              </button>
              <button
                type="button"
                onClick={() => toggleOutbound(account.id, !account.outbound_paused)}
                disabled={savingId === account.id}
                className={
                  account.outbound_paused
                    ? "rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                    : "rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                }
              >
                {account.outbound_paused ? "Resume outbound" : "Pause outbound"}
              </button>
            </div>
          </div>
        </ContentCard>
      ))}
    </div>
  );
}
