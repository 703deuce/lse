"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type { StoredCompetitor } from "@/lib/maps/grid-entity";

export interface SpotCheckMarker {
  id: string;
  lat: number;
  lng: number;
  rank: number | null;
  keyword: string;
  label: string | null;
  checkedAt: string;
}

export interface SpotCheckDetail {
  id: string;
  keyword: string;
  rank: number | null;
  match_reason: string | null;
  checked_at: string;
  lat: number;
  lng: number;
  raw_results: StoredCompetitor[];
}

function rowToSpotCheckDetail(row: {
  id: string;
  keyword: string;
  rank: number | null;
  match_reason: string | null;
  checked_at: string;
  lat: number;
  lng: number;
  raw_results?: StoredCompetitor[] | null;
}): SpotCheckDetail {
  return {
    id: row.id,
    keyword: row.keyword,
    rank: row.rank,
    match_reason: row.match_reason,
    checked_at: row.checked_at,
    lat: row.lat,
    lng: row.lng,
    raw_results: (row.raw_results ?? []) as StoredCompetitor[],
  };
}

interface SinglePointConfirmModalProps {
  lat: number;
  lng: number;
  keywords: Array<{ id: string; keyword: string }>;
  defaultKeywordId: string | null;
  onConfirm: (keywordId: string, keyword: string, label: string) => void;
  onCancel: () => void;
}

export function SinglePointConfirmModal({
  lat,
  lng,
  keywords,
  defaultKeywordId,
  onConfirm,
  onCancel,
}: SinglePointConfirmModalProps) {
  const [keywordId, setKeywordId] = useState(defaultKeywordId ?? keywords[0]?.id ?? "");
  const [label, setLabel] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
        <h3 className="font-semibold">Check rank from this point?</h3>
        <p className="mt-1 text-xs text-text-muted">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-muted">Keyword</label>
            <select
              value={keywordId}
              onChange={(e) => setKeywordId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-border px-3.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const kw = keywords.find((k) => k.id === keywordId);
              if (kw) onConfirm(keywordId, kw.keyword, label);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Run Check
          </button>
        </div>
      </div>
    </div>
  );
}

interface SpotCheckInspectorProps {
  checkId: string | null;
  businessId: string;
  cachedDetail?: SpotCheckDetail | null;
  onClose: () => void;
}

export function SpotCheckInspector({
  checkId,
  businessId,
  cachedDetail,
  onClose,
}: SpotCheckInspectorProps) {
  const [data, setData] = useState<SpotCheckDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkId) {
      setData(null);
      setLoadError(null);
      return;
    }

    if (cachedDetail?.id === checkId) {
      setData(cachedDetail);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setData(null);
    setLoadError(null);
    setLoading(true);

    fetch(`/api/single-point-rank/${businessId}?checkId=${encodeURIComponent(checkId)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          throw new Error(json.error ?? "Failed to load check");
        }
        if (json.check) {
          setData(rowToSpotCheckDetail(json.check));
        } else {
          setLoadError("Check not found");
        }
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load check");
      })
      .finally(() => setLoading(false));
  }, [checkId, businessId, cachedDetail]);

  if (!checkId) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-border bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">Spot Check</h2>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface-subtle dark:hover:bg-zinc-800">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-y-auto p-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : data ? (
          <>
            <p className="text-sm text-text-muted">{data.keyword}</p>
            <p className="mt-1 text-lg font-bold tabular-nums leading-none">
              {data.rank != null ? `#${rankLabel(data.rank)}` : "20+"}
            </p>
            {data.match_reason && (
              <p className="mt-1 text-xs text-text-muted">Match: {data.match_reason}</p>
            )}
            <p className="mt-1 text-xs text-text-muted">
              {data.lat.toFixed(5)}, {data.lng.toFixed(5)} ·{" "}
              {new Date(data.checked_at).toLocaleString()}
            </p>
            <h3 className="mt-4 text-sm font-semibold">Top results</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {(data.raw_results ?? []).slice(0, 20).map((r, i) => (
                <li
                  key={r.cid ?? r.place_id ?? i}
                  className="flex justify-between gap-2 rounded border border-border px-2 py-1 dark:border-zinc-800"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-text-muted">#{i + 1}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-text-muted">{loadError ?? "Check not found"}</p>
        )}
      </div>
    </div>
  );
}
