"use client";

import { useState } from "react";
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

type Cell = {
  label: string;
  row: number;
  col: number;
  rank: number | null;
  found: boolean;
};

type RankResult = {
  keyword: string;
  business: { name: string };
  average_rank: number | null;
  visibility_score: number;
  cells: Cell[];
  top_competitors: { rank: number; name: string; is_you: boolean }[];
  upgrade_hint?: string;
};

function rankColor(rank: number | null): string {
  if (rank == null) return "bg-[#F04438] text-white";
  if (rank <= 3) return "bg-[#137752] text-white";
  if (rank <= 10) return "bg-[#12B76A] text-white";
  if (rank <= 20) return "bg-[#FDB022] text-[#0B1220]";
  return "bg-[#F04438] text-white";
}

function rankLabel(rank: number | null): string {
  if (rank == null) return "20+";
  if (rank > 20) return "20+";
  return String(rank);
}

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

  const grid = result?.cells
    ? [...result.cells].sort((a, b) => a.row - b.row || a.col - b.col)
    : null;

  return (
    <FreeToolShell
      embed={embed}
      title="Free Google Maps Rank Checker"
      subtitle="Enter your business and a keyword to see where you rank across a local 3×3 Maps grid."
      steps={[
        { label: "Find your business" },
        { label: "Enter a keyword" },
        { label: "Check the grid" },
        { label: "Review competitors" },
      ]}
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
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
          {checking ? (
            <p className="text-sm text-[#667085]">Running a free 3×3 Maps grid — this can take up to a minute.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
          {result && grid ? (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                    Average rank
                  </p>
                  <p className="text-3xl font-extrabold text-[#0B1220]">
                    {result.average_rank != null ? result.average_rank : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                    Visibility
                  </p>
                  <p className="text-xl font-extrabold text-[#137752]">{result.visibility_score}%</p>
                </div>
              </div>

              <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2">
                {grid.map((cell) => (
                  <div
                    key={cell.label}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-full text-sm font-extrabold shadow-sm",
                      rankColor(cell.rank)
                    )}
                    title={`${cell.label}: ${rankLabel(cell.rank)}`}
                  >
                    {rankLabel(cell.rank)}
                  </div>
                ))}
              </div>

              {result.top_competitors?.length ? (
                <div className="mt-5">
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#667085]">
                    Top competitors
                  </p>
                  <ol className="space-y-1.5">
                    {result.top_competitors.map((row) => (
                      <li
                        key={`${row.rank}-${row.name}`}
                        className="flex items-center justify-between rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-[#0B1220]">{row.name}</span>
                        <span className="font-bold text-[#137752]">#{row.rank}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <p className="mt-4 text-[12px] text-[#667085]">
                {result.upgrade_hint ||
                  "Sign up to unlock larger grids, history, and keyword tracking."}
              </p>
            </>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="mb-3 grid grid-cols-3 gap-2 opacity-40">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-12 w-12 rounded-full bg-[#D0D5DD]" />
                ))}
              </div>
              <p className="text-sm font-semibold text-[#344054]">Your 3×3 rank grid will appear here</p>
              <p className="mt-1 max-w-[28ch] text-[12px] text-[#667085]">
                Find your business, enter a keyword, then tap Check My Rank.
              </p>
            </div>
          )}
        </div>
      </div>
    </FreeToolShell>
  );
}
