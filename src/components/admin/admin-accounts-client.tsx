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
  usage: Record<string, number>;
};

const PLAN_OPTIONS: PlanId[] = ["starter", "pro", "agency", "internal"];

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

  if (error) {
    return <ContentCard><p className="text-sm text-red-600">{error}</p></ContentCard>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/ops" className="text-emerald-700 underline">
          Ops console
        </Link>{" "}
        — queues, Redis, job retry/cancel
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
                  <option key={p} value={p}>
                    {p}
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
            </div>
          </div>
        </ContentCard>
      ))}
    </div>
  );
}
