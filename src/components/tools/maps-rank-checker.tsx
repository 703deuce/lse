"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  business: { name: string; place_id: string; address?: string };
  center: { lat: number; lng: number };
  rank: number | null;
  found: boolean;
  visibility_score: number;
  top_results: { rank: number; name: string; is_you: boolean }[];
  upgrade_hint?: string;
};

export function MapsRankChecker({ embed = false }: { embed?: boolean }) {
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [result, setResult] = useState<RankResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const lockedCells = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div className={cn(embed ? "min-h-screen bg-[#F7FAF8] p-4" : "mx-auto max-w-2xl px-4 py-10")}>
      {!embed ? (
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#027A48]">
            Free tool
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1220]">
            Free Google Maps Rank Checker
          </h1>
          <p className="mt-2 text-[15px] text-[#667085]">
            Check one keyword at your business location. Sign up for full area grid scans and history.
          </p>
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[#344054]">
            Your business
          </span>
          <div className="flex gap-2">
            <input
              className="h-11 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
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
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#D0D5DD] px-3 text-sm font-semibold text-[#344054] disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find
            </button>
          </div>
        </label>

        {candidates.length > 0 ? (
          <ul className="max-h-48 overflow-auto rounded-lg border border-[#E6EAF0]">
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
                    selected?.place_id === c.place_id && "bg-[#ECFDF3]"
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
          <p className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-3 py-1 text-[12px] font-semibold text-[#027A48]">
            <MapPin className="h-3.5 w-3.5" />
            {selected.name}
          </p>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[#344054]">
            Keyword to check
          </span>
          <input
            className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. plumber near me"
          />
        </label>

        <button
          type="button"
          disabled={checking || !selected || keyword.trim().length < 2}
          onClick={() => void runCheck()}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#137752] text-sm font-semibold text-white hover:bg-[#0f6344] disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Check my local ranking
        </button>

        {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

        {result ? (
          <div className="space-y-4 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] p-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#027A48]">
                Free spot check result
              </p>
              <p className="mt-1 text-2xl font-bold text-[#0B1220]">
                {result.found && result.rank != null
                  ? `#${result.rank} for “${result.keyword}”`
                  : `Not found in the top results for “${result.keyword}”`}
              </p>
              <p className="mt-1 text-[13px] text-[#144C34]">
                Checked at your business location ({result.center.lat.toFixed(4)},{" "}
                {result.center.lng.toFixed(4)}). Visibility score: {result.visibility_score}.
              </p>
            </div>

            {result.top_results?.length ? (
              <ol className="space-y-1.5 rounded-lg border border-[#A6F4C5] bg-white/70 p-3">
                {result.top_results.map((row) => (
                  <li
                    key={`${row.rank}-${row.name}`}
                    className={cn(
                      "flex items-center justify-between gap-2 text-sm",
                      row.is_you && "font-semibold text-[#027A48]"
                    )}
                  >
                    <span>
                      #{row.rank} {row.name}
                      {row.is_you ? " (you)" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}

            <div>
              <p className="mb-2 text-[12px] font-semibold text-[#144C34]">
                Full area grid (unlock with free account)
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {lockedCells.map((i) => {
                  const isCenter = i === 4;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md text-[11px] font-bold",
                        isCenter && result.found && result.rank != null
                          ? "bg-[#137752] text-white"
                          : isCenter
                            ? "bg-[#F79009] text-white"
                            : "bg-[#D0D5DD]/70 text-[#667085] blur-[0.5px]"
                      )}
                    >
                      {isCenter
                        ? result.found && result.rank != null
                          ? `#${result.rank}`
                          : "—"
                        : "?"}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-[#144C34]">
                {result.upgrade_hint ||
                  "Sign up to scan your whole service area and compare results over time."}
              </p>
              <Link
                href="/sign-up"
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-[#0B1220] px-4 text-sm font-semibold text-white"
              >
                Unlock full grid scans
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {!embed ? (
        <p className="mt-6 text-center text-[13px] text-[#667085]">
          Track rankings across your service area with{" "}
          <Link href="/sign-up" className="font-semibold text-[#137752] hover:underline">
            Local SEO Express
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
