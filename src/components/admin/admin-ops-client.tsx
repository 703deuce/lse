"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ContentCard, btnSecondary } from "@/components/ui/design-system";

type Overview = {
  drivers: { queue: string; cache: string; lock: string };
  redis: { configured: boolean; ok: boolean; latencyMs?: number; error?: string };
  brightData: { maxInFlight: number };
  dbLimiter: { inFlight: number; waiting: number; max: number };
  jobCounts: Record<string, number>;
  providers: Array<{ provider: string; circuitOpen: boolean }>;
  checkedAt: string;
};

type OpsJob = {
  id: string;
  jobType: string;
  status: string;
  enqueueState: string;
  organizationId: string | null;
  businessId: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt?: string;
  lifecycleStatus?: string | null;
};

type UsageRollup = {
  billingPeriod: string;
  totals: { estimatedCostUsd: number; actualCostUsd: number; units: number; rowCount: number };
  byOrganization: Array<{
    organizationId: string;
    estimatedCostUsd: number;
    actualCostUsd: number;
    units: number;
    rows: number;
  }>;
  byProvider: Array<{ provider: string; estimatedCostUsd: number; units: number }>;
};

export function AdminOpsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [jobs, setJobs] = useState<OpsJob[]>([]);
  const [usage, setUsage] = useState<UsageRollup | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/ops/overview");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load overview");
    setOverview(json);
  }, []);

  const loadJobs = useCallback(async () => {
    const params = new URLSearchParams({ limit: "50" });
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/ops/jobs?${params}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to list jobs");
    setJobs(json.jobs ?? []);
  }, [status, q]);

  const loadUsage = useCallback(async () => {
    const res = await fetch("/api/admin/ops/usage?limit=100");
    const json = await res.json();
    if (!res.ok) {
      // Soft-fail when usage_ledger is not migrated yet.
      setUsage(null);
      return;
    }
    setUsage(json);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadOverview(), loadJobs(), loadUsage()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ops");
    }
  }, [loadOverview, loadJobs, loadUsage]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void loadOverview(), 15_000);
    return () => clearInterval(id);
  }, [refresh, loadOverview]);

  async function act(jobId: string, action: "retry" | "cancel") {
    setBusyId(jobId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ops/jobs/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          Internal queue / provider health.{" "}
          <Link href="/admin/accounts" className="text-emerald-700 underline">
            Accounts
          </Link>
        </p>
        <button type="button" className={btnSecondary} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      {error && (
        <ContentCard>
          <p className="text-sm text-red-600">{error}</p>
        </ContentCard>
      )}

      {overview && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ContentCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Drivers</p>
            <p className="mt-1 text-sm text-zinc-900">
              queue={overview.drivers.queue} · cache={overview.drivers.cache} · lock=
              {overview.drivers.lock}
            </p>
          </ContentCard>
          <ContentCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Redis</p>
            <p className="mt-1 text-sm text-zinc-900">
              {!overview.redis.configured
                ? "not configured"
                : overview.redis.ok
                  ? `ok (${overview.redis.latencyMs ?? "—"}ms)`
                  : `down: ${overview.redis.error ?? "unreachable"}`}
            </p>
          </ContentCard>
          <ContentCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Job counts</p>
            <p className="mt-1 text-sm text-zinc-900">
              pending {overview.jobCounts.pending ?? 0} · running {overview.jobCounts.running ?? 0} ·
              failed {overview.jobCounts.failed ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              enqueue_failed {overview.jobCounts.enqueue_failed ?? 0} · completed{" "}
              {overview.jobCounts.completed ?? 0}
            </p>
          </ContentCard>
          <ContentCard>
            <p className="text-xs uppercase tracking-wide text-zinc-500">DB limiter</p>
            <p className="mt-1 text-sm text-zinc-900">
              {overview.dbLimiter.inFlight}/{overview.dbLimiter.max} in flight
              {overview.dbLimiter.waiting > 0 ? ` · ${overview.dbLimiter.waiting} waiting` : ""}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Bright Data max in-flight {overview.brightData.maxInFlight}
            </p>
          </ContentCard>
        </div>
      )}

      {overview && (
        <ContentCard>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Provider circuits</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {overview.providers.map((p) => (
              <span
                key={p.provider}
                className={`rounded px-2 py-0.5 text-xs ${
                  p.circuitOpen ? "bg-red-100 text-red-800" : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {p.provider}
                {p.circuitOpen ? " open" : " ok"}
              </span>
            ))}
          </div>
        </ContentCard>
      )}

      {usage && (
        <ContentCard>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Cost / usage — {usage.billingPeriod}
          </p>
          <p className="mt-1 text-sm text-zinc-900">
            est ${usage.totals.estimatedCostUsd.toFixed(4)} · actual $
            {usage.totals.actualCostUsd.toFixed(4)} · {usage.totals.units} units ·{" "}
            {usage.totals.rowCount} ledger rows
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-zinc-500">By organization</p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                {usage.byOrganization.slice(0, 8).map((o) => (
                  <li key={o.organizationId} className="font-mono">
                    {o.organizationId.slice(0, 8)}… ${o.estimatedCostUsd.toFixed(4)} ({o.rows} rows)
                  </li>
                ))}
                {!usage.byOrganization.length && <li className="text-zinc-400">No usage rows yet</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">By provider</p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-700">
                {usage.byProvider.slice(0, 8).map((p) => (
                  <li key={p.provider}>
                    {p.provider}: ${p.estimatedCostUsd.toFixed(4)} · {p.units} units
                  </li>
                ))}
                {!usage.byProvider.length && <li className="text-zinc-400">No provider spend yet</li>}
              </ul>
            </div>
          </div>
        </ContentCard>
      )}

      <ContentCard>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Status</span>
            <select
              className="rounded border border-zinc-200 px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Any</option>
              <option value="pending">pending</option>
              <option value="running">running</option>
              <option value="failed">failed</option>
              <option value="completed">completed</option>
              <option value="canceled">canceled</option>
            </select>
          </label>
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block text-xs text-zinc-500">Search (job type or UUID)</span>
            <input
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="process_scan or job id"
            />
          </label>
          <button type="button" className={btnSecondary} onClick={() => void loadJobs()}>
            Search
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Job</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 pr-3 font-medium">Attempts</th>
                <th className="py-1.5 pr-3 font-medium">Error</th>
                <th className="py-1.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-zinc-100 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-zinc-900">{job.jobType}</div>
                    <div className="font-mono text-[11px] text-zinc-500">{job.id}</div>
                    {job.organizationId && (
                      <div className="text-[11px] text-zinc-400">org {job.organizationId}</div>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <div>{job.status}</div>
                    <div className="text-[11px] text-zinc-500">
                      {job.lifecycleStatus ?? job.enqueueState}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="max-w-[240px] py-2 pr-3 text-xs text-zinc-600">
                    {job.errorMessage ?? "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(job.status === "failed" || job.status === "canceled") && (
                        <button
                          type="button"
                          disabled={busyId === job.id}
                          className={btnSecondary}
                          onClick={() => void act(job.id, "retry")}
                        >
                          Retry
                        </button>
                      )}
                      {(job.status === "pending" || job.status === "running") && (
                        <button
                          type="button"
                          disabled={busyId === job.id}
                          className={btnSecondary}
                          onClick={() => void act(job.id, "cancel")}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                    No jobs match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ContentCard>
    </div>
  );
}
