"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AuditCheckTable } from "@/components/audit/audit-check-table";
import { MetricCard } from "@/components/ui/metric-card";
import type { AuditCheck } from "@/lib/audit/types";

export type AuditModuleVariant =
  | "website-match"
  | "category-gap"
  | "core30"
  | "hyperlocal"
  | "competitor-gaps";

export function AuditModuleRunner({
  businessId,
  module,
  variant,
  keyword,
  title,
}: {
  businessId: string;
  module: string;
  variant: AuditModuleVariant;
  keyword?: string;
  title: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audits/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, module, keyword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Running…
            </span>
          ) : (
            `Run ${title}`
          )}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {result && (
        <div className="mt-8">
          <AuditModuleResults variant={variant} result={result} />
        </div>
      )}
    </div>
  );
}

function AuditModuleResults({ variant, result }: { variant: AuditModuleVariant; result: Record<string, unknown> }) {
  switch (variant) {
    case "website-match":
      return (
        <div>
          <p className="mb-4 text-lg font-semibold">Score: {String(result.score ?? 0)}%</p>
          <AuditCheckTable checks={(result.checks ?? []) as AuditCheck[]} />
        </div>
      );
    case "category-gap": {
      const missing = (result.missingPages ?? []) as Array<{
        service: string;
        suggestedTitle: string;
        reason: string;
      }>;
      const opportunities = (result.missingOpportunities ?? []) as string[];
      return (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4 dark:border-zinc-800">
              <p className="text-xs uppercase text-text-muted">Primary</p>
              <p className="mt-1 font-semibold">{String(result.primaryCategory ?? "—")}</p>
            </div>
            <div className="rounded-xl border border-border p-4 dark:border-zinc-800">
              <p className="text-xs uppercase text-text-muted">Secondary</p>
              <p className="mt-1">{(result.secondaryCategories as string[])?.join(", ") || "—"}</p>
            </div>
          </div>
          {opportunities.length > 0 && (
            <div>
              <h2 className="font-semibold">Competitor-used categories you do not have</h2>
              <p className="mt-1 text-sm text-text-muted">
                These categories were found on ranking competitors in Maps results. Add only if they accurately describe your business.
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-text-muted">
                {opportunities.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {(result.categoryAlignment as { recommendations?: Array<{ recommendationText: string; category: string }> })?.recommendations?.length ? (
            <div>
              <h2 className="font-semibold">Evidence-based suggestions</h2>
              <ul className="mt-2 space-y-2 text-sm text-text-muted">
                {((result.categoryAlignment as { recommendations: Array<{ recommendationText: string; category: string }> }).recommendations).slice(0, 5).map((r) => (
                  <li key={r.category} className="rounded-lg border border-border p-3">
                    <span className="font-medium text-text">{r.category}</span>
                    <p className="mt-1">{r.recommendationText}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h2 className="font-semibold">Missing website pages ({missing.length})</h2>
            <div className="mt-4 space-y-3">
              {missing.map((p) => (
                <div key={p.service} className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="font-medium">Missing page: {p.service}</p>
                  <p className="mt-1 text-sm">Suggested title: {p.suggestedTitle}</p>
                  <p className="mt-1 text-xs text-text-muted">{p.reason}</p>
                </div>
              ))}
              {!missing.length && <p className="text-sm text-text-muted">All listed services have matching pages.</p>}
            </div>
          </div>
        </div>
      );
    }
    case "core30": {
      const missing = (result.missingPages ?? []) as Array<{ name: string; suggestedTitle: string }>;
      const weak = (result.weakPages ?? []) as Array<{ url: string; issue: string }>;
      const wrong = (result.wrongTitlePages ?? []) as Array<{ url: string; title: string | null; expected: string }>;
      return (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-4">
            <MetricCard label="Completion Score" value={`${result.completionScore}%`} />
            <MetricCard label="GBP Services" value={String(result.gbpServicesFound ?? 0)} />
            <MetricCard label="Matching Pages" value={String(result.matchingPagesFound ?? 0)} />
            <MetricCard label="Missing Pages" value={String(missing.length)} />
          </div>
          {missing.length > 0 && (
            <section>
              <h2 className="font-semibold">Missing pages</h2>
              <div className="mt-3 space-y-2">
                {missing.map((p) => (
                  <div key={p.name} className="rounded-lg border border-border p-3 text-sm dark:border-zinc-800">
                    {p.name} → <span className="text-text-muted">{p.suggestedTitle}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {weak.length > 0 && (
            <section>
              <h2 className="font-semibold">Weak pages</h2>
              <ul className="mt-2 space-y-1 text-sm text-text-muted">
                {weak.map((w) => (
                  <li key={w.url}>{w.url}: {w.issue}</li>
                ))}
              </ul>
            </section>
          )}
          {wrong.length > 0 && (
            <section>
              <h2 className="font-semibold">Wrong title tags</h2>
              <ul className="mt-2 space-y-1 text-sm text-text-muted">
                {wrong.map((w) => (
                  <li key={w.url}>{w.url}: &quot;{w.title}&quot; → expected &quot;{w.expected}&quot;</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      );
    }
    case "hyperlocal": {
      const opps = (result.opportunities ?? []) as Array<{
        service: string;
        neighborhood: string;
        suggestedTitle: string;
        status: string;
        checks: Array<{ label: string; pass: boolean }>;
        pageUrl?: string;
      }>;
      return (
        <div className="space-y-6">
          <MetricCard label="Hyper-Local Score" value={`${result.score ?? 0}%`} />
          <div className="space-y-4">
            {opps.map((o) => (
              <div key={`${o.service}-${o.neighborhood}`} className="rounded-xl border border-border p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{o.suggestedTitle}</p>
                  <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs capitalize dark:bg-zinc-800">{o.status}</span>
                </div>
                {o.pageUrl && <p className="mt-1 text-xs text-text-muted">{o.pageUrl}</p>}
                <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                  {o.checks.map((c) => (
                    <li key={c.label} className={`text-sm ${c.pass ? "text-primary" : "text-text-muted"}`}>
                      {c.pass ? "✓" : "○"} {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "competitor-gaps": {
      const competitors = (result.competitors ?? []) as Array<{
        name: string;
        rating: number;
        reviewCount: number;
        categories: string[];
        servicePageCount?: number;
        homepageWordCount?: number;
      }>;
      const why = (result.whyTheyBeatYou ?? []) as string[];
      const gaps = (result.yourGaps ?? []) as string[];
      return (
        <div className="space-y-8">
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-900/20">
            <h2 className="font-semibold text-red-900 dark:text-red-200">Why they beat you</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-red-800 dark:text-red-200/90">
              {why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-semibold">Your gaps to close</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-text-muted">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-semibold">Top competitors</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {competitors.map((c) => (
                <div key={c.name} className="rounded-xl border border-border p-4 dark:border-zinc-800">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-text-muted">{c.rating} ★ · {c.reviewCount} reviews</p>
                  <p className="mt-2 text-xs text-text-muted">{c.categories?.join(", ")}</p>
                  <p className="mt-2 text-xs">Service pages: {c.servicePageCount ?? 0} · Words: {c.homepageWordCount ?? 0}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }
    default:
      return <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>;
  }
}
