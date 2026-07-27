"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Search } from "lucide-react";
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
  lat?: number;
  lng?: number;
};

type RankResult = {
  keyword: string;
  business: { name: string; address?: string };
  location?: { lat: number; lng: number };
  rank: number | null;
  found: boolean;
  top_competitors: { rank: number; name: string; is_you: boolean }[];
  upgrade_hint?: string;
};

const IMPROVE_TIPS = [
  "Optimize your Google Business Profile",
  "Get more Google reviews",
  "Build local citations for NAP consistency",
] as const;

export function MapsRankChecker({ embed = false }: { embed?: boolean }) {
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [result, setResult] = useState<RankResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkedAt = useMemo(
    () => (result ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null),
    [result]
  );

  async function searchPlaces() {
    setSearching(true);
    setError(null);
    setCandidates([]);
    setResult(null);
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

  async function runCheck() {
    if (!selected) return;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/maps-rank-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          placeId: selected.place_id,
          name: selected.name,
          address: selected.address,
          lat: selected.lat ?? null,
          lng: selected.lng ?? null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as RankResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "Rank check failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rank check failed");
    } finally {
      setChecking(false);
    }
  }

  const rankLabel =
    result?.found && result.rank != null ? String(result.rank) : result ? "20+" : null;

  return (
    <FreeToolShell
      embed={embed}
      title="Free Google Maps Rank Checker"
      subtitle="Check your rank from one location for one keyword. Start a free trial for area grid scans."
      steps={[
        { label: "Find your business" },
        { label: "Enter a keyword" },
        { label: "Check one location" },
        { label: "See your rank" },
      ]}
      ctaHref="/sign-up?next=/scans"
      ctaLabel="Start free trial for grid scans"
      footerNote="Trial credits unlock service-area grid scans with history."
    >
      {!result ? (
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <FreeToolField label="Business Name">
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
              <ul className="max-h-40 overflow-auto rounded-xl border border-[#E6EAF0]">
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

            {selected ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-[12px] font-bold text-[#137752]">
                <MapPin className="h-3.5 w-3.5" />
                {selected.name}
              </p>
            ) : null}

            <FreeToolField label="Keyword">
              <input
                className={freeToolInputClass}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. plumber near me"
              />
            </FreeToolField>

            <button
              type="button"
              disabled={checking || !selected || keyword.trim().length < 2}
              onClick={() => void runCheck()}
              className={cn(freeToolPrimaryBtnClass, "w-full")}
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Check My Rank
            </button>
            {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
            <p className="text-[12px] text-[#667085]">Up to 2 free one-location checks per day.</p>
          </div>

          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-5 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFDF5] text-2xl font-extrabold text-[#137752]">
              #
            </div>
            <p className="text-sm font-semibold text-[#344054]">Your one-location rank will appear here</p>
            <p className="mt-1 max-w-[28ch] text-[12px] text-[#667085]">
              This free checker is a single search point — not a full area grid scan.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr_0.75fr]">
            <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Search info</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-[11px] font-bold text-[#98A2B3]">Keyword</dt>
                  <dd className="font-semibold text-[#0B1220]">{result.keyword}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold text-[#98A2B3]">Location</dt>
                  <dd className="font-semibold text-[#0B1220]">
                    {selected?.address || result.business.address || result.business.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold text-[#98A2B3]">Date</dt>
                  <dd className="font-semibold text-[#0B1220]">{checkedAt}</dd>
                </div>
              </dl>
            </div>

            <div
              className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-[#D0D5DD] shadow-sm"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(243,245,247,0.55), rgba(243,245,247,0.7)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cpath fill='%23cfd8e3' d='M0 40h160v2H0zm0 40h160v2H0zm0 40h160v2H0zM40 0h2v160h-2zm40 0h2v160h-2zm40 0h2v160h-2z'/%3E%3Cpath fill='none' stroke='%23a8b7c7' stroke-width='2' d='M10 120c20-30 40-20 60-40s40-10 70-30'/%3E%3C/svg%3E\")",
                backgroundSize: "cover",
              }}
            >
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#137752] text-4xl font-extrabold text-white shadow-xl ring-4 ring-white">
                {rankLabel}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Your Rank</p>
                <p className="mt-1 text-4xl font-extrabold text-[#0B1220]">
                  {rankLabel === "20+" ? "20+" : `#${rankLabel}`}
                </p>
                <p className="mt-1 text-[12px] text-[#667085]">At this one search location</p>
              </div>
              <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                  Ranking over time
                </p>
                <svg viewBox="0 0 160 48" className="mt-2 h-12 w-full" aria-hidden="true">
                  <path
                    d="M4 36 C28 34, 40 28, 56 24 S90 30, 110 18 S140 10, 156 8"
                    fill="none"
                    stroke="#137752"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 36 C28 34, 40 28, 56 24 S90 30, 110 18 S140 10, 156 8 L156 48 L4 48 Z"
                    fill="rgba(19,119,82,0.12)"
                  />
                </svg>
                <p className="mt-1 text-[11px] text-[#98A2B3]">History unlocks with a free trial</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                How to improve your ranking
              </p>
              <ol className="mt-3 space-y-2">
                {IMPROVE_TIPS.map((tip, i) => (
                  <li key={tip} className="flex gap-2 text-sm text-[#344054]">
                    <span className="font-extrabold text-[#137752]">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ol>
              {result.top_competitors?.length ? (
                <div className="mt-4 border-t border-[#F2F4F7] pt-4">
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                    Top competitors here
                  </p>
                  <ol className="space-y-1.5">
                    {result.top_competitors.slice(0, 4).map((row) => (
                      <li
                        key={`${row.rank}-${row.name}`}
                        className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-[#0B1220]">{row.name}</span>
                        <span className="font-bold text-[#137752]">#{row.rank}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <Link
                href="/sign-up?next=/scans"
                className={cn(freeToolPrimaryBtnClass, "w-full")}
              >
                Run Full Scan
              </Link>
              <div className="rounded-2xl border border-[#A6F4C5] bg-[#ECFDF5] p-4">
                <p className="text-sm font-extrabold text-[#027A48]">Unlock the full report</p>
                <p className="mt-1 text-[12px] text-[#027A48]/90">
                  {result.upgrade_hint ||
                    "Want rankings across your whole service area? Start your free trial for credit-based grid scans."}
                </p>
                <Link
                  href="/sign-up?next=/scans"
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-[#137752] px-4 text-sm font-bold text-white"
                >
                  Unlock Full Report
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="w-full text-center text-sm font-bold text-[#667085] hover:text-[#137752]"
              >
                Check another keyword
              </button>
            </div>
          </div>
        </div>
      )}
    </FreeToolShell>
  );
}
