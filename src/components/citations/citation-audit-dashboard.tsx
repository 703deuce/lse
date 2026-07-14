"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, ListChecks } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import type { NapIssue } from "@/lib/citations/nap-match";

type TabId = "overview" | "found" | "missing" | "nap" | "competitors" | "tasks";

type AuditData = {
  audit: {
    id: string;
    status: string;
    score: number | null;
    found_count: number;
    missing_count: number;
    nap_issue_count: number;
    competitor_gap_count: number;
    ai_summary: string | null;
    progress_stage: string | null;
    warnings: string[];
    error_message: string | null;
    created_at: string;
  } | null;
  listings: Array<Record<string, unknown>>;
  missing: Array<Record<string, unknown>>;
  competitorPresence: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  napIssues: NapIssue[];
  hasCompetitors: boolean;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "found", label: "Found Listings" },
  { id: "missing", label: "Missing" },
  { id: "nap", label: "NAP Issues" },
  { id: "competitors", label: "Competitor Gap" },
  { id: "tasks", label: "Tasks" },
];

function napBadge(status: string) {
  const colors: Record<string, string> = {
    match: "bg-emerald-100 text-emerald-800",
    partial: "bg-amber-100 text-amber-800",
    mismatch: "bg-red-100 text-red-800",
    missing_data: "bg-surface-subtle text-text",
    unverified: "bg-slate-100 text-slate-600",
  };
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? colors.unverified}`}>
      {label}
    </span>
  );
}

function priorityBadge(p: string) {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-surface-subtle text-text-muted",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[p] ?? colors.medium}`}>
      {p}
    </span>
  );
}

export function CitationAuditDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/citations/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      if (!opts?.quiet) setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.audit?.status !== "running") return;
    const id = setInterval(() => void load({ quiet: true }), 4000);
    return () => clearInterval(id);
  }, [data?.audit?.status, load]);

  async function runAudit() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/citations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Audit failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  }

  async function createTasks() {
    try {
      const res = await fetch("/api/citations/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task creation failed");
    }
  }

  const audit = data?.audit;
  const isRunning = audit?.status === "running" || running;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAudit}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Citation Audit
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-subtle dark:border-zinc-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
        {audit && (
          <button
            type="button"
            onClick={createTasks}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-subtle dark:border-zinc-700"
          >
            <ListChecks className="h-4 w-4" />
            Create Tasks
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {audit?.progress_stage && isRunning && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {audit.progress_stage}…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Citation Health" value={audit?.score != null ? `${audit.score}/100` : "—"} />
        <MetricCard label="Found Listings" value={audit?.found_count ?? 0} />
        <MetricCard label="Missing Opportunities" value={audit?.missing_count ?? 0} />
        <MetricCard label="NAP Issues" value={audit?.nap_issue_count ?? 0} />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-primary text-emerald-700"
                : "text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !audit ? (
        <div className="flex items-center justify-center py-16 text-text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : !audit ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center dark:border-zinc-700">
          <p className="text-text-muted">No citation audit yet. Run your first audit to find listings and NAP issues.</p>
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <div className="space-y-6">
              {audit.ai_summary && (
                <div className="rounded-xl border border-border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                  <h3 className="font-semibold">Summary</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted dark:text-text-muted">{audit.ai_summary}</p>
                </div>
              )}
              {data?.napIssues && data.napIssues.length > 0 && (
                <div>
                  <h3 className="font-semibold">Top issues</h3>
                  <ul className="mt-2 list-inside list-disc text-sm text-text-muted">
                    {data.napIssues.slice(0, 3).map((i, idx) => (
                      <li key={idx}>{i.source}: {i.issueType}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data?.missing && data.missing.length > 0 && (
                <div>
                  <h3 className="font-semibold">Top opportunities</h3>
                  <ul className="mt-2 space-y-2">
                    {data.missing.slice(0, 5).map((m) => (
                      <li key={String(m.id)} className="flex items-center gap-2 text-sm">
                        {priorityBadge(String(m.priority))}
                        <span>{String(m.source_name)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "found" && (
            <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">NAP</th>
                    <th className="px-4 py-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(data?.listings ?? []).map((l) => (
                    <tr key={String(l.id)}>
                      <td className="px-4 py-3 font-medium">{String(l.source_name)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3">
                        {l.listing_url ? (
                          <a href={String(l.listing_url)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Link
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">{String(l.name_found ?? "—")}</td>
                      <td className="px-4 py-3">{String(l.phone_found ?? "—")}</td>
                      <td className="px-4 py-3">{napBadge(String(l.nap_status))}</td>
                      <td className="px-4 py-3 capitalize">{String(l.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "missing" && (
            <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Competitors</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Search</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(data?.missing ?? []).map((m) => (
                    <tr key={String(m.id)}>
                      <td className="px-4 py-3 font-medium">{String(m.source_name)}</td>
                      <td className="px-4 py-3">{priorityBadge(String(m.priority))}</td>
                      <td className="px-4 py-3">{String(m.competitor_count ?? 0)}</td>
                      <td className="px-4 py-3 text-text-muted">{String(m.reason ?? "")}</td>
                      <td className="px-4 py-3">
                        {m.suggested_search_url ? (
                          <a href={String(m.suggested_search_url)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Search
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "nap" && (
            <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
              {(data?.napIssues ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-text-muted">No NAP issues detected.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Issue</th>
                      <th className="px-4 py-3">Expected</th>
                      <th className="px-4 py-3">Found</th>
                      <th className="px-4 py-3">Fix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {(data?.napIssues ?? []).map((i, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-medium">{i.source}</td>
                        <td className="px-4 py-3">{i.issueType}</td>
                        <td className="px-4 py-3">{i.expected}</td>
                        <td className="px-4 py-3">{i.found}</td>
                        <td className="px-4 py-3 text-text-muted">{i.fixRecommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "competitors" && (
            <div>
              {!data?.hasCompetitors ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Run a grid scan first to unlock competitor citation gaps.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border dark:border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
                      <tr>
                        <th className="px-4 py-3">Competitor</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Competitor listed?</th>
                        <th className="px-4 py-3">You listed?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {(data?.competitorPresence ?? []).map((c) => {
                        const youListed = (data?.listings ?? []).some(
                          (l) => l.source_domain === c.source_domain
                        );
                        return (
                          <tr key={String(c.id)}>
                            <td className="px-4 py-3">{String(c.competitor_name)}</td>
                            <td className="px-4 py-3">{String(c.source_name)}</td>
                            <td className="px-4 py-3">{c.listed ? "Yes" : "No"}</td>
                            <td className="px-4 py-3">{youListed ? "Yes" : "No"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "tasks" && (
            <ul className="space-y-3">
              {(data?.tasks ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">No tasks yet. Run an audit or click Create Tasks.</p>
              ) : (
                data?.tasks.map((t) => (
                  <li key={String(t.id)} className="rounded-xl border border-border p-4 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{String(t.title)}</span>
                      {priorityBadge(String(t.priority))}
                      <span className="text-xs text-text-muted">Impact: {String(t.impact)} · Effort: {String(t.effort)}</span>
                    </div>
                    {t.description ? <p className="mt-2 text-sm text-text-muted">{String(t.description)}</p> : null}
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
