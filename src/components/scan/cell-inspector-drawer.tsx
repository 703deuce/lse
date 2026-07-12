"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Fingerprint,
  GitCompare,
  Globe,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type { StoredCompetitor } from "@/lib/maps/grid-entity";
import type { CellWhyResult } from "@/lib/maps/cell-why";
import { CompetitorFingerprintDrawer } from "@/components/competitors/competitor-fingerprint-drawer";
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
    device: string;
    os: string;
    browser: string;
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
  checkUrl?: string | null;
  sourceTimestamp?: string | null;
  provider?: string;
  debug?: Record<string, unknown>;
};

type TabId = "results" | "why" | "raw";

interface CellInspectorDrawerProps {
  scanId: string;
  cellId: string | null;
  keywordId?: string | null;
  businessId: string;
  selectedEntityKey?: string;
  enrichmentComplete?: boolean;
  variant?: "drawer" | "panel";
  pointLabel?: string | null;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
  onClose: () => void;
  onCompareCell?: (cellId: string) => void;
  onOpenCompetitorCompare?: (entityKey: string) => void;
  onShowCompetitorGrid?: (entityKey: string) => void;
}

const isDev = process.env.NODE_ENV === "development";
const INITIAL_RESULTS_SHOWN = 10;
const MAX_RESULTS_SHOWN = 20;

export function CellInspectorDrawer({
  scanId,
  cellId,
  keywordId,
  businessId,
  selectedEntityKey = "you",
  enrichmentComplete = false,
  variant = "drawer",
  pointLabel,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev = false,
  canNavigateNext = false,
  onClose,
  onCompareCell,
  onOpenCompetitorCompare,
  onShowCompetitorGrid,
}: CellInspectorDrawerProps) {
  const [data, setData] = useState<CellInspectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<TabId>("results");
  const [whyData, setWhyData] = useState<CellWhyResult | null>(null);
  const [whyLoading, setWhyLoading] = useState(false);
  const [whyError, setWhyError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<{
    entityKey: string;
    competitorId?: string | null;
    raw?: StoredCompetitor;
  } | null>(null);
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
    } else setData(null);
  }, [cellId, load]);

  useEffect(() => {
    if (tab === "why" && cellId && enrichmentComplete && !whyData && !whyLoading) void loadWhy();
  }, [tab, cellId, enrichmentComplete, whyData, whyLoading, loadWhy]);

  if (!cellId) return null;

  async function copyCoordinates() {
    if (!data) return;
    const text = `${data.cell.lat}, ${data.cell.lng}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openCompetitor(raw: StoredCompetitor) {
    if (!enrichmentComplete) return;
    const res = await fetch("/api/competitors/resolve-from-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, scanId, rawResult: raw }),
    });
    const json = await res.json();
    setFingerprint({
      entityKey: json.entityKey,
      competitorId: json.competitorId,
      raw,
    });
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

  const panelBody = (
    <div
      className={
        variant === "panel"
          ? "flex h-full w-[min(100vw,400px)] shrink-0 flex-col border-l border-zinc-200 bg-white"
          : "flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
      }
      onClick={variant === "drawer" ? (e) => e.stopPropagation() : undefined}
    >
      <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-zinc-900">Cell Inspector</h2>
          {(pointLabel || data) && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Point <span className="font-semibold text-zinc-800">{pointLabel ?? data?.cell.label}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {variant === "panel" && onNavigatePrev && (
            <button
              type="button"
              disabled={!canNavigatePrev}
              onClick={onNavigatePrev}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
              aria-label="Previous point"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {variant === "panel" && onNavigateNext && (
            <button
              type="button"
              disabled={!canNavigateNext}
              onClick={onNavigateNext}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
              aria-label="Next point"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-0 border-b border-zinc-200 px-4">
        {tabs.map((t) => {
          const whyLocked = t.id === "why" && !enrichmentComplete;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !whyLocked && setTab(t.id)}
              disabled={whyLocked}
              title={whyLocked ? "Available after competitor enrichment finishes" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                tab === t.id
                  ? "border-[#137752] text-[#137752]"
                  : whyLocked
                    ? "cursor-not-allowed border-transparent text-zinc-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading rank data…
          </div>
        )}
        {error && <p className="text-red-600">{error}</p>}

        {data && !loading && tab === "results" && (
          <div className="space-y-4">
            <section className="rounded-lg border border-zinc-200 bg-white p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Your rank
              </p>
              <p className="mt-0.5 text-[34px] font-bold leading-none text-[#137752]">
                {data.target.found ? `#${rankLabel(data.target.rank)}` : "20+"}
              </p>
              <p className="mt-2 text-[13px] text-zinc-700">
                <span className="text-zinc-500">Keyword:</span>{" "}
                <span className="font-medium">{data.keyword?.keyword ?? "—"}</span>
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                Coords: {data.cell.lat.toFixed(6)}, {data.cell.lng.toFixed(6)}
              </p>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              {onCompareCell && (
                <button
                  type="button"
                  onClick={() => onCompareCell(data.cell.id)}
                  className={gridInspectorActionBtn}
                >
                  <GitCompare className="h-3.5 w-3.5" /> Compare this cell
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyCoordinates()}
                className={gridInspectorActionBtn}
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy coordinates"}
              </button>
              {data.checkUrl && (
                <a
                  href={data.checkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={gridInspectorActionBtn}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Verify on Maps
                </a>
              )}
            </div>

            <section>
              <h3 className="text-[13px] font-semibold text-zinc-900">Top results at this point</h3>
              {!data.hasRawResults ? (
                <p className="mt-2 text-zinc-500">Raw results not stored for this scan.</p>
              ) : (
                <>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="w-8 px-2 py-2">#</th>
                          <th className="px-2 py-2">Business</th>
                          <th className="px-2 py-2">Rating</th>
                          <th className="hidden px-2 py-2 sm:table-cell">Category</th>
                          <th className="px-2 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {visibleResults.map((r, i) => {
                          const isTarget =
                            data.target.matchedResult &&
                            (r.cid === data.target.matchedResult.cid ||
                              r.place_id === data.target.matchedResult.place_id ||
                              r.name === data.target.matchedResult.name);
                          return (
                            <tr
                              key={`${r.place_id ?? r.cid ?? r.name ?? i}`}
                              className={cn(isTarget && "border-l-2 border-[#137752] bg-emerald-50/40")}
                            >
                              <td className="px-2 py-2.5 align-top font-semibold tabular-nums text-zinc-600">
                                {r.rank ?? i + 1}
                              </td>
                              <td className="max-w-[140px] px-2 py-2.5 align-top">
                                <button
                                  type="button"
                                  onClick={() => void openCompetitor(r)}
                                  className="text-left text-[13px] font-semibold text-blue-700 hover:underline"
                                >
                                  {r.name ?? "—"}
                                </button>
                                {r.address && (
                                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-500">
                                    {r.address}
                                  </p>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2.5 align-top">
                                <GridStarRating rating={r.rating} reviewCount={r.review_count} />
                              </td>
                              <td className="hidden max-w-[100px] px-2 py-2.5 align-top text-[11px] text-zinc-600 sm:table-cell">
                                {r.category ?? "—"}
                              </td>
                              <td className="px-2 py-2.5 align-top text-right">
                                <div className="flex flex-col items-end gap-1">
                                  {enrichmentComplete ? (
                                    <button
                                      type="button"
                                      onClick={() => void openCompetitor(r)}
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-[#137752]"
                                    >
                                      <Fingerprint className="h-3 w-3" />
                                      Fingerprint
                                    </button>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 text-[11px] text-zinc-400"
                                      title="Available after enrichment"
                                    >
                                      <Fingerprint className="h-3 w-3" />
                                      Fingerprint
                                    </span>
                                  )}
                                  {r.url ? (
                                    <a
                                      href={r.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 hover:text-[#137752]"
                                    >
                                      <Globe className="h-3 w-3" />
                                      Website
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-zinc-300">Website</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {canLoadMore && (
                    <button
                      type="button"
                      onClick={() => setExpandedResults(true)}
                      className="mt-2 w-full rounded-md border border-zinc-200 py-2 text-[13px] font-medium text-[#137752] hover:bg-emerald-50/50"
                    >
                      Load more ({Math.min(MAX_RESULTS_SHOWN, data.rawResults.length) - INITIAL_RESULTS_SHOWN}{" "}
                      more)
                    </button>
                  )}
                  {expandedResults && data.rawResults.length > INITIAL_RESULTS_SHOWN && (
                    <button
                      type="button"
                      onClick={() => setExpandedResults(false)}
                      className="mt-2 w-full text-center text-[12px] font-medium text-zinc-500 hover:text-zinc-700"
                    >
                      Show fewer
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {tab === "why" && (
          <div className="space-y-4">
            {!enrichmentComplete && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Show Me Why is available after competitor enrichment finishes.
              </p>
            )}
            {enrichmentComplete && whyLoading && (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </div>
            )}
            {enrichmentComplete && whyError && !whyLoading && (
              <p className="text-red-600">{whyError}</p>
            )}
            {enrichmentComplete && !whyData && !whyLoading && !whyError && (
              <p className="text-zinc-500">No analysis available for this cell.</p>
            )}
            {enrichmentComplete && whyData && !whyLoading && (
              <>
                <div>
                  <h3 className="font-semibold text-zinc-900">Why this rank?</h3>
                  <p className="text-xs text-zinc-500">
                    Based on observable differences at this search point.
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
                  <p className="text-zinc-500">Not enough cached data to compare at this point.</p>
                )}
              </>
            )}
          </div>
        )}

        {tab === "raw" && data && (
          <pre className="overflow-x-auto rounded bg-zinc-50 p-3 text-xs text-zinc-800">
            {JSON.stringify(data.rawResults, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5">
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
            Updated {new Date(data.sourceTimestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {variant === "panel" ? (
        panelBody
      ) : (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
          {panelBody}
        </div>
      )}

      {fingerprint && (
        <CompetitorFingerprintDrawer
          businessId={businessId}
          scanId={scanId}
          keywordId={keywordId}
          competitorId={fingerprint.competitorId}
          entityKey={fingerprint.entityKey}
          rawResult={fingerprint.raw}
          onClose={() => setFingerprint(null)}
          onShowGrid={onShowCompetitorGrid}
          onCompare={onOpenCompetitorCompare}
        />
      )}
    </>
  );
}
