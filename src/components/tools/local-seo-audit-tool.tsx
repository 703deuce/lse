"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FreeToolField,
  FreeToolShell,
  freeToolInputClass,
  freeToolPrimaryBtnClass,
} from "@/components/tools/free-tool-shell";

type PlaceCandidate = {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  review_count?: number;
};

type CitationRow = {
  source: string;
  status: "found" | "missing" | "inconsistent";
  authority: number;
};

type AuditResult = {
  score: number;
  business: {
    name: string;
    rating: number | null;
    review_count: number | null;
    phone?: string | null;
    website?: string | null;
  };
  categories: Record<string, { good: number; fix: number; total: number }>;
  to_fix: { id: string; label: string; detail: string; status: string }[];
  citations?: CitationRow[];
  upgrade_hint?: string;
};

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#E6EAF0" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#137752"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold text-[#0B1220]">{score}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Score</span>
      </div>
    </div>
  );
}

export function LocalSeoAuditTool({ embed = false }: { embed?: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [running, setRunning] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "report">("overview");

  async function searchPlaces() {
    setSearching(true);
    setError(null);
    setCandidates([]);
    setResult(null);
    setView("overview");
    try {
      const res = await fetch("/api/public/qr/places-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        candidates?: PlaceCandidate[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Search failed");
      setCandidates(json.candidates ?? []);
      if (!(json.candidates ?? []).length) {
        setError("No matching businesses found. Try a more specific name and city.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function runAudit() {
    if (!selected) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/local-seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: selected.place_id,
          name: selected.name,
          address: selected.address,
          rating: selected.rating,
          reviewCount: selected.review_count,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as AuditResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "Audit failed");
      setResult(json);
      setView("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setRunning(false);
    }
  }

  const categoryCards = result
    ? [
        { key: "profile", label: "Google Profile" },
        { key: "website", label: "Website" },
        { key: "reviews", label: "Reviews" },
        { key: "citations", label: "Citations" },
      ]
    : [];

  return (
    <FreeToolShell
      embed={embed}
      title="Local SEO Audit"
      subtitle="Find Google Business Profile problems holding you back—and get a clear list of what to fix next."
      steps={[
        { label: "Find your business" },
        { label: "Run the free audit" },
        { label: "Review your score" },
        { label: "Fix what matters first" },
      ]}
      ctaLabel="Get started"
    >
      {!result ? (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <FreeToolField label="Business name">
              <div className="flex gap-2">
                <input
                  className={freeToolInputClass}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Business name + city"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchPlaces();
                  }}
                />
                <button
                  type="button"
                  disabled={searching || query.trim().length < 2}
                  onClick={() => void searchPlaces()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D0D5DD] px-3 text-sm font-bold text-[#344054] disabled:opacity-50"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Find
                </button>
              </div>
            </FreeToolField>

            {candidates.length > 0 ? (
              <ul className="max-h-48 overflow-auto rounded-xl border border-[#E6EAF0]">
                {candidates.map((c) => (
                  <li key={c.place_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(c);
                        setResult(null);
                      }}
                      className={cn(
                        "w-full border-b border-[#F2F4F7] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#F7FAF8]",
                        selected?.place_id === c.place_id && "bg-[#ECFDF5]"
                      )}
                    >
                      <span className="font-semibold text-[#0B1220]">{c.name}</span>
                      <span className="mt-0.5 block text-[12px] text-[#667085]">{c.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <button
              type="button"
              disabled={running || !selected}
              onClick={() => void runAudit()}
              className={cn(freeToolPrimaryBtnClass, "w-full")}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Start My Audit
            </button>
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
          </div>

          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4 text-center">
            <div className="mb-3 h-28 w-28 rounded-full border-[10px] border-[#E6EAF0]" />
            <p className="text-sm font-semibold text-[#344054]">Your audit score will appear here</p>
            <p className="mt-1 max-w-[28ch] text-[12px] text-[#667085]">
              Find your business and tap Start My Audit for a free Google Business Profile check.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("overview")}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12px] font-bold",
                view === "overview"
                  ? "border-[#137752] bg-[#ECFDF5] text-[#137752]"
                  : "border-[#D0D5DD] text-[#344054]"
              )}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setView("report")}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12px] font-bold",
                view === "report"
                  ? "border-[#137752] bg-[#ECFDF5] text-[#137752]"
                  : "border-[#D0D5DD] text-[#344054]"
              )}
            >
              Detailed Report
            </button>
          </div>

          {view === "overview" ? (
            <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <ScoreRing score={result.score} />
                <div className="grid grid-cols-2 gap-2">
                  {categoryCards.map((card) => {
                    const data = result.categories[card.key];
                    return (
                      <div key={card.key} className="rounded-xl border border-[#E6EAF0] bg-white p-3">
                        <p className="text-[12px] font-bold text-[#0B1220]">{card.label}</p>
                        <p className="mt-1 text-[12px] text-[#137752]">{data?.good ?? 0} Good</p>
                        <p className="text-[12px] text-[#B54708]">{data?.fix ?? 0} To Fix</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                  What to Fix First
                </p>
                {result.to_fix.length ? (
                  <ul className="space-y-2">
                    {result.to_fix.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2.5"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F79009]" />
                        <div>
                          <p className="text-sm font-bold text-[#0B1220]">{item.label}</p>
                          <p className="text-[12px] text-[#667085]">{item.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-[#A6F4C5] bg-[#ECFDF5] px-3 py-3 text-sm font-semibold text-[#027A48]">
                    <CheckCircle2 className="h-4 w-4" />
                    Looking solid on the free checklist—sign up for the full audit.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                  <ScoreRing score={result.score} />
                  <div className="flex flex-wrap gap-3 text-[12px] font-semibold text-[#344054]">
                    <span className="rounded-full bg-white px-3 py-1.5 border border-[#E6EAF0]">
                      {result.business.rating != null
                        ? `${result.business.rating.toFixed(1)} Rating`
                        : "No rating"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1.5 border border-[#E6EAF0]">
                      {result.business.review_count ?? 0} Reviews
                    </span>
                    <span className="rounded-full bg-white px-3 py-1.5 border border-[#E6EAF0]">
                      {result.citations?.length ?? 0} Citations
                    </span>
                    <span className="rounded-full bg-white px-3 py-1.5 border border-[#E6EAF0]">
                      {result.to_fix.length} To fix
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white">
                  <div className="border-b border-[#E6EAF0] px-4 py-3">
                    <p className="text-sm font-extrabold text-[#0B1220]">Citations Found</p>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-wide text-[#667085]">
                      <tr>
                        <th className="px-4 py-2 font-bold">Source</th>
                        <th className="px-4 py-2 font-bold">Status</th>
                        <th className="px-4 py-2 font-bold">Authority Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.citations ?? []).map((row) => (
                        <tr key={row.source} className="border-t border-[#F2F4F7]">
                          <td className="px-4 py-2.5 font-semibold text-[#0B1220]">{row.source}</td>
                          <td className="px-4 py-2.5">
                            {row.status === "found" ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[#137752]">
                                <CheckCircle2 className="h-4 w-4" /> Found
                              </span>
                            ) : row.status === "inconsistent" ? (
                              <span className="inline-flex items-center gap-1 font-bold text-[#B54708]">
                                <AlertTriangle className="h-4 w-4" /> Check
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-bold text-[#B42318]">
                                <XCircle className="h-4 w-4" /> Missing
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-[#344054]">{row.authority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
                <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                  Top Recommendations
                </p>
                <ul className="space-y-2">
                  {(result.to_fix.length ? result.to_fix : [
                    {
                      id: "ok",
                      label: "Keep monitoring",
                      detail: "Basics look solid—unlock the full audit for deeper fixes.",
                      status: "good",
                    },
                  ]).slice(0, 5).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-[#E6EAF0] bg-white px-3 py-3"
                    >
                      <p className="text-sm font-bold text-[#0B1220]">{item.label}</p>
                      <p className="mt-1 text-[12px] text-[#667085]">{item.detail}</p>
                      <Link
                        href="/sign-up"
                        className="mt-2 inline-flex h-8 items-center rounded-full bg-[#137752] px-3 text-[12px] font-bold text-white"
                      >
                        Fix now
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runAudit()}
              disabled={running || !selected}
              className={cn(freeToolPrimaryBtnClass, "h-10")}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run a New Audit
            </button>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#0B1220] px-4 text-sm font-bold text-white"
            >
              Unlock full Local SEO Audit
            </Link>
          </div>
          {result.upgrade_hint ? (
            <p className="text-[12px] text-[#667085]">{result.upgrade_hint}</p>
          ) : null}
        </div>
      )}
    </FreeToolShell>
  );
}
