"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  GitCompare,
  Globe,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import { rankLabel } from "@/lib/maps/grid-metrics";
import { formatPriceLevel, type StoredCompetitor } from "@/lib/maps/grid-entity";
import type { CellWhyResult } from "@/lib/maps/cell-why";
import { GridStarRating, gridInspectorActionBtn } from "@/components/scan/grid-rank-ui";
import { cn } from "@/lib/utils";

type CellInspectorData = {
  cell: {
    id: string;
    label: string;
    row: number;
    col: number;
    lat: number;
    lng: number;
    distanceFromCenterM?: number | null;
  };
  keyword: { id: string; keyword: string } | null;
  scan: {
    id: string;
    gridSize: number;
    radiusMeters: number;
    createdAt: string;
    finishedAt?: string | null;
  };
  target: {
    rank: number | null;
    found: boolean;
    matchReason: string | null;
    matchedResult: StoredCompetitor | null;
  };
  rawResults: StoredCompetitor[];
  resultCount: number;
  hasRawResults: boolean;
  sparseResults?: boolean;
  sparseReason?: string | null;
  checkUrl?: string | null;
  sourceTimestamp?: string | null;
};

type TabId = "results" | "why" | "raw";

interface CellInspectorDrawerProps {
  scanId: string;
  cellId: string | null;
  keywordId?: string | null;
  businessId: string;
  selectedEntityKey?: string;
  variant?: "drawer" | "panel";
  /** Keep the panel mounted even before a cell is selected (left SERP rail). */
  alwaysVisible?: boolean;
  pointLabel?: string | null;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
  onClose: () => void;
  onCompareCell?: (cellId: string) => void;
  className?: string;
}

const isDev = process.env.NODE_ENV === "development";
/** Keep the rail short so the map stays visible without a tall workspace. */
const INITIAL_RESULTS_SHOWN = 5;
const MAX_RESULTS_SHOWN = 20;

function isTargetListing(
  r: StoredCompetitor,
  matched: StoredCompetitor | null | undefined
): boolean {
  if (!matched) return false;
  return (
    (!!r.cid && r.cid === matched.cid) ||
    (!!r.place_id && r.place_id === matched.place_id) ||
    (!!r.name && r.name === matched.name)
  );
}

function justificationTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((j) => {
      if (typeof j === "string") return j;
      if (j && typeof j === "object" && "text" in j) {
        const t = (j as { text?: unknown }).text;
        return typeof t === "string" ? t : null;
      }
      return null;
    })
    .filter((t): t is string => !!t?.trim());
}

function rankTone(rank: number): string {
  if (rank <= 3) return "text-emerald-600";
  if (rank <= 10) return "text-amber-600";
  return "text-rose-500";
}

function SerpListingCard({
  listing,
  index,
  isTarget,
  compact = false,
}: {
  listing: StoredCompetitor;
  index: number;
  isTarget: boolean;
  /** Denser row so ~5 listings fit above the fold in the Rank Grid rail. */
  compact?: boolean;
}) {
  const rank = listing.rank ?? index + 1;
  const price = formatPriceLevel(listing.price_level);
  const justifications = justificationTexts(listing.local_justifications);
  const category = listing.category ?? listing.additional_categories?.[0] ?? null;

  if (compact) {
    return (
      <article
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 transition-colors",
          isTarget ? "bg-emerald-50/70" : "hover:bg-zinc-50/80"
        )}
      >
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/80">
          {listing.main_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.main_image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <MapPin className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        <span className={cn("w-4 shrink-0 text-[12px] font-bold tabular-nums", rankTone(rank))}>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate text-[12px] font-semibold leading-tight text-zinc-900">
              {listing.name ?? "Untitled listing"}
            </h4>
            {isTarget ? (
              <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                You
              </span>
            ) : null}
            {price ? (
              <span className="shrink-0 text-[10px] font-semibold text-zinc-400">{price}</span>
            ) : null}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500">
            <GridStarRating rating={listing.rating} reviewCount={listing.review_count} />
            {category ? <span className="truncate">· {category}</span> : null}
            {listing.total_photos != null && listing.total_photos > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 font-medium">
                <Camera className="h-2.5 w-2.5" />
                {listing.total_photos.toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
        {listing.url ? (
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full p-1.5 text-[#137752] hover:bg-emerald-50"
            aria-label="Website"
          >
            <Globe className="h-3.5 w-3.5" />
          </a>
        ) : listing.phone ? (
          <a
            href={`tel:${listing.phone}`}
            className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
            aria-label="Call"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "flex gap-2.5 px-3.5 py-2.5 transition-colors",
        isTarget ? "bg-emerald-50/70" : "hover:bg-zinc-50/80"
      )}
    >
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/80">
        {listing.main_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.main_image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <MapPin className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <span className={cn("mt-0.5 w-5 shrink-0 text-[12px] font-bold tabular-nums", rankTone(rank))}>
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="truncate text-[13px] font-semibold leading-snug text-zinc-900">
                {listing.name ?? "Untitled listing"}
                {isTarget ? (
                  <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    You
                  </span>
                ) : null}
              </h4>
              {price ? (
                <span className="shrink-0 text-[11px] font-semibold text-zinc-400">{price}</span>
              ) : null}
            </div>

            {category ? (
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">{category}</p>
            ) : null}

            <div className="mt-0.5">
              <GridStarRating rating={listing.rating} reviewCount={listing.review_count} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
              {listing.total_photos != null && listing.total_photos > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  <Camera className="h-3 w-3" />
                  {listing.total_photos.toLocaleString()}
                </span>
              ) : null}
              {listing.phone ? (
                <a href={`tel:${listing.phone}`} className="inline-flex items-center gap-1 hover:text-[#137752]">
                  <Phone className="h-3 w-3" />
                  Call
                </a>
              ) : null}
              {listing.url ? (
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#137752] hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  Site
                </a>
              ) : null}
            </div>

            {justifications[0] ? (
              <p className="mt-1 line-clamp-1 text-[11px] italic text-zinc-400">
                {justifications[0]}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function CellInspectorDrawer({
  scanId,
  cellId,
  keywordId,
  selectedEntityKey = "you",
  variant = "drawer",
  alwaysVisible = false,
  pointLabel,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev = false,
  canNavigateNext = false,
  onClose,
  onCompareCell,
  className,
}: CellInspectorDrawerProps) {
  const [data, setData] = useState<CellInspectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<TabId>("results");
  const [whyData, setWhyData] = useState<CellWhyResult | null>(null);
  const [whyLoading, setWhyLoading] = useState(false);
  const [whyError, setWhyError] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState(false);

  const load = useCallback(async () => {
    if (!cellId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (keywordId) params.set("keywordId", keywordId);
      const res = await fetch(`/api/scans/${scanId}/cells/${cellId}?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load cell");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scanId, cellId, keywordId]);

  const loadWhy = useCallback(async () => {
    if (!cellId) return;
    setWhyLoading(true);
    setWhyError(null);
    try {
      const params = new URLSearchParams();
      if (keywordId) params.set("keywordId", keywordId);
      if (selectedEntityKey && selectedEntityKey !== "you") {
        params.set("entityKey", selectedEntityKey);
      }
      const res = await fetch(`/api/scans/${scanId}/cells/${cellId}/why?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Why analysis failed");
      setWhyData(json);
    } catch (e) {
      setWhyData(null);
      setWhyError(e instanceof Error ? e.message : "Why analysis failed");
    } finally {
      setWhyLoading(false);
    }
  }, [scanId, cellId, keywordId, selectedEntityKey]);

  useEffect(() => {
    if (cellId) {
      void load();
      setTab("results");
      setWhyData(null);
      setWhyError(null);
      setExpandedResults(false);
    } else {
      setData(null);
      setError(null);
    }
  }, [cellId, load]);

  useEffect(() => {
    if (tab === "why" && cellId && !whyData && !whyLoading) void loadWhy();
  }, [tab, cellId, whyData, whyLoading, loadWhy]);

  if (!cellId && !alwaysVisible) return null;

  async function copyCoordinates() {
    if (!data) return;
    const text = `${data.cell.lat}, ${data.cell.lng}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "results", label: "Results" },
    { id: "why", label: "Show Me Why" },
    ...(isDev ? [{ id: "raw" as const, label: "Raw Data" }] : []),
  ];

  const visibleLimit = expandedResults ? MAX_RESULTS_SHOWN : INITIAL_RESULTS_SHOWN;
  const visibleResults = data?.rawResults.slice(0, visibleLimit) ?? [];
  const canLoadMore =
    (data?.rawResults.length ?? 0) > INITIAL_RESULTS_SHOWN && !expandedResults;

  const yourRankLabel = data?.target.found
    ? `Rank ${rankLabel(data.target.rank)}`
    : data
      ? "Rank 20+"
      : null;
  const matched = data?.target.matchedResult;
  const packShare =
    data && data.rawResults.length > 0
      ? Math.round(
          (data.rawResults.filter((r) => isTargetListing(r, data.target.matchedResult)).length /
            Math.max(1, data.rawResults.length)) *
            100
        )
      : null;

  const isPanel = variant === "panel";

  const panelBody = (
    <div
      className={cn(
        isPanel
          ? "flex h-full w-full min-w-0 flex-col bg-[#FAFBFC]"
          : "flex h-full w-full max-w-xl flex-col bg-white shadow-xl",
        className
      )}
      onClick={variant === "drawer" ? (e) => e.stopPropagation() : undefined}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-zinc-200/80 bg-white",
          isPanel ? "px-3 py-2" : "items-start px-4 py-3.5"
        )}
      >
        <div className="min-w-0">
          {!isPanel ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Search point
            </p>
          ) : null}
          <h2
            className={cn(
              "truncate font-bold tracking-tight text-zinc-900",
              isPanel ? "text-[13px]" : "mt-0.5 text-[16px]"
            )}
          >
            {data?.keyword?.keyword ?? "Local results"}
            {isPanel && (pointLabel || data?.cell.label) ? (
              <span className="ml-1.5 font-medium text-zinc-400">
                · Pin {pointLabel ?? data?.cell.label}
              </span>
            ) : null}
          </h2>
          {!isPanel ? (
            <p className="mt-0.5 text-[12px] text-zinc-500">
              {pointLabel || data?.cell.label
                ? `Pin ${pointLabel ?? data?.cell.label}`
                : "Center pin loads automatically"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {isPanel && onNavigatePrev && (
            <button
              type="button"
              disabled={!canNavigatePrev}
              onClick={onNavigatePrev}
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
              aria-label="Previous point"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {isPanel && onNavigateNext && (
            <button
              type="button"
              disabled={!canNavigateNext}
              onClick={onNavigateNext}
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
              aria-label="Next point"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {cellId ? (
        <div className={cn("flex gap-1 border-b border-zinc-200/80 bg-white", isPanel ? "px-2" : "px-3")}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px border-b-2 font-semibold transition-colors",
                isPanel ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2.5 text-[13px]",
                tab === t.id
                  ? "border-[#137752] text-[#137752]"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto text-sm">
        {!cellId && (
          <div className="px-4 py-10 text-center text-[13px] text-zinc-500">
            Waiting for the center pin to load…
          </div>
        )}

        {cellId && loading && (
          <div className="flex items-center gap-2 px-4 py-8 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading local results…
          </div>
        )}
        {cellId && error && <p className="px-4 py-4 text-red-600">{error}</p>}

        {data && !loading && tab === "results" && (
          <div>
            <section
              className={cn(
                "border-b border-zinc-200/80 bg-white",
                isPanel ? "px-3 py-2" : "px-3.5 py-3"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "relative shrink-0 overflow-hidden bg-zinc-100 ring-1 ring-zinc-200/80",
                    isPanel ? "h-9 w-9 rounded-lg" : "h-11 w-11 rounded-xl"
                  )}
                >
                  {matched?.main_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={matched.main_image}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <MapPin className={isPanel ? "h-4 w-4" : "h-5 w-5"} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full font-bold",
                        isPanel ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]",
                        data.target.found
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
                      )}
                    >
                      {yourRankLabel}
                    </span>
                    <p
                      className={cn(
                        "min-w-0 truncate font-semibold text-zinc-900",
                        isPanel ? "text-[12px]" : "text-[13px]"
                      )}
                    >
                      {matched?.name ?? "Your business"}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <GridStarRating
                      rating={matched?.rating}
                      reviewCount={matched?.review_count}
                    />
                    {!isPanel && packShare != null ? (
                      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
                        {data.resultCount} listings
                      </span>
                    ) : null}
                  </div>
                </div>
                {isPanel ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {data.checkUrl ? (
                      <a
                        href={data.checkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full p-1.5 text-[#137752] hover:bg-emerald-50"
                        aria-label="Open in Google"
                        title="Open in Google"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {onCompareCell ? (
                      <button
                        type="button"
                        onClick={() => onCompareCell(data.cell.id)}
                        className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
                        aria-label="Compare"
                        title="Compare"
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void copyCoordinates()}
                      className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
                      aria-label={copied ? "Copied" : "Copy coordinates"}
                      title={copied ? "Copied" : "Copy coordinates"}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>

              {!isPanel ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {data.checkUrl ? (
                    <a
                      href={data.checkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#137752] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.22)] hover:bg-[#0f6344]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open in Google
                    </a>
                  ) : null}
                  {onCompareCell ? (
                    <button
                      type="button"
                      onClick={() => onCompareCell(data.cell.id)}
                      className={gridInspectorActionBtn}
                    >
                      <GitCompare className="h-3.5 w-3.5" /> Compare
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void copyCoordinates()}
                    className={gridInspectorActionBtn}
                  >
                    <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Coords"}
                  </button>
                </div>
              ) : null}
            </section>

            {data.sparseResults && (
              <p
                className={cn(
                  "rounded-xl border border-amber-200 bg-amber-50 text-amber-900",
                  isPanel ? "mx-3 mt-2 px-2.5 py-1.5 text-[11px]" : "mx-4 mt-3 px-3 py-2 text-[12px]"
                )}
              >
                {data.sparseReason ??
                  "Maps returned too few listings for this point. Recovery may still retry it."}
              </p>
            )}

            <div
              className={cn(
                "flex items-center justify-between",
                isPanel ? "px-3 pb-0.5 pt-2" : "px-4 pb-1 pt-3.5"
              )}
            >
              <h3 className={cn("font-bold text-zinc-900", isPanel ? "text-[12px]" : "text-[13px]")}>
                Competitors ({data.resultCount})
              </h3>
              <span className="text-[10px] font-medium text-zinc-400">
                Showing {Math.min(visibleLimit, data.resultCount)}
              </span>
            </div>

            {!data.hasRawResults ? (
              <p className="px-4 py-6 text-zinc-500">No listings stored for this point yet.</p>
            ) : (
              <>
                <div className="divide-y divide-zinc-100/90 border-t border-zinc-100 bg-white">
                  {visibleResults.map((r, i) => (
                    <SerpListingCard
                      key={`${r.place_id ?? r.cid ?? r.name ?? i}`}
                      listing={r}
                      index={i}
                      isTarget={isTargetListing(r, data.target.matchedResult)}
                      compact={isPanel}
                    />
                  ))}
                </div>
                {canLoadMore && (
                  <button
                    type="button"
                    onClick={() => setExpandedResults(true)}
                    className={cn(
                      "w-full border-t border-zinc-100 bg-white font-semibold text-[#137752] hover:bg-emerald-50/50",
                      isPanel ? "py-2 text-[12px]" : "py-3.5 text-[13px]"
                    )}
                  >
                    Show more (
                    {Math.min(MAX_RESULTS_SHOWN, data.rawResults.length) - INITIAL_RESULTS_SHOWN}{" "}
                    more)
                  </button>
                )}
                {expandedResults && data.rawResults.length > INITIAL_RESULTS_SHOWN && (
                  <button
                    type="button"
                    onClick={() => setExpandedResults(false)}
                    className="w-full border-t border-zinc-100 bg-white py-2 text-center text-[12px] font-medium text-zinc-500 hover:text-zinc-700"
                  >
                    Show fewer
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === "why" && cellId && (
          <div className="space-y-4 px-3.5 py-4">
            {whyLoading && (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </div>
            )}
            {whyError && !whyLoading && <p className="text-red-600">{whyError}</p>}
            {!whyData && !whyLoading && !whyError && (
              <p className="text-zinc-500">No analysis available for this cell.</p>
            )}
            {whyData && !whyLoading && (
              <>
                <div>
                  <h3 className="font-semibold text-zinc-900">Why this rank?</h3>
                  <p className="text-xs text-zinc-500">
                    Based on listings returned at this search point.
                  </p>
                  <p className="mt-2 text-zinc-800">
                    <strong>{whyData.selectedEntity.name}</strong> is #
                    {rankLabel(whyData.selectedEntity.rank)} here.
                  </p>
                </div>
                {whyData.businessesAbove.length > 0 && (
                  <section>
                    <h4 className="text-sm font-semibold text-zinc-900">Businesses above</h4>
                    <ul className="mt-2 space-y-2">
                      {whyData.businessesAbove.map((b) => (
                        <li
                          key={`${b.cid ?? b.place_id ?? b.name}`}
                          className="rounded border border-zinc-200 p-2"
                        >
                          <p className="font-medium text-zinc-900">
                            #{b.rank} {b.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {b.rating != null && `${b.rating} ★ · `}
                            {b.review_count ?? 0} reviews
                            {b.distanceMiles != null && ` · ${b.distanceMiles} mi away`}
                            {b.category && ` · ${b.category}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {whyData.visibleGaps.length > 0 && (
                  <section>
                    <h4 className="text-sm font-semibold text-zinc-900">Main visible gaps</h4>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-600">
                      {whyData.visibleGaps.map((g) => (
                        <li key={g.text}>{g.text}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {whyData.visibleGaps.length === 0 && whyData.businessesAbove.length === 0 && (
                  <p className="text-zinc-500">
                    You rank at the top of this point, or there are no other listings to compare.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {tab === "raw" && data && (
          <pre className="overflow-x-auto p-3 text-xs text-zinc-800">
            {JSON.stringify(data.rawResults, null, 2)}
          </pre>
        )}
      </div>

      {cellId ? (
        <div className="flex items-center justify-between border-t border-zinc-200 px-3.5 py-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
          </button>
          {data?.sourceTimestamp && (
            <span className="text-[11px] text-zinc-400">
              Updated{" "}
              {new Date(data.sourceTimestamp).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
          {variant === "drawer" ? (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              Close
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (variant === "panel") {
    return panelBody;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      {panelBody}
    </div>
  );
}
