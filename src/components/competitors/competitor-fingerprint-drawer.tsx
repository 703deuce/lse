"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import type { CompetitorFingerprint } from "@/lib/competitors/fingerprint";
import { rankLabel } from "@/lib/maps/grid-metrics";

interface CompetitorFingerprintDrawerProps {
  businessId: string;
  scanId?: string | null;
  keywordId?: string | null;
  competitorId?: string | null;
  entityKey?: string;
  rawResult?: Record<string, unknown>;
  name?: string;
  onClose: () => void;
  onShowGrid?: (entityKey: string) => void;
  onCompare?: (entityKey: string) => void;
}

function StrengthBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-text-muted dark:text-text-muted">{label}</span>
        <span className="tabular-nums text-text-muted">{value != null ? value : "—"}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-subtle dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: value != null ? `${value}%` : "0%" }}
        />
      </div>
    </div>
  );
}

export function CompetitorFingerprintDrawer({
  businessId,
  scanId,
  keywordId,
  competitorId,
  entityKey,
  rawResult,
  onClose,
  onShowGrid,
  onCompare,
}: CompetitorFingerprintDrawerProps) {
  const [data, setData] = useState<CompetitorFingerprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let res: Response;
        if (competitorId) {
          const params = new URLSearchParams({ businessId });
          if (scanId) params.set("scanId", scanId);
          if (keywordId) params.set("keywordId", keywordId);
          if (entityKey) params.set("entityKey", entityKey);
          res = await fetch(`/api/competitors/${competitorId}/fingerprint?${params}`);
        } else if (entityKey) {
          res = await fetch("/api/competitors/from-entity/fingerprint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              scanId,
              keywordId,
              entityKey,
              rawResult,
            }),
          });
        } else {
          throw new Error("No competitor specified");
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [businessId, scanId, keywordId, competitorId, entityKey, rawResult]);

  const key = data?.competitor.entityKey ?? entityKey;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold">Competitor Fingerprint</h2>
            {data?.competitor.limitedData && (
              <span className="text-xs text-amber-600">Limited data</span>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface-subtle dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {loading && (
            <div className="flex items-center gap-2 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {error && <p className="text-red-600">{error}</p>}
          {data && !loading && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-bold">{data.competitor.name}</h3>
                {data.competitor.category && (
                  <p className="text-text-muted">{data.competitor.category}</p>
                )}
                <p className="mt-1 tabular-nums">
                  {data.competitor.rating != null && `${data.competitor.rating} ★ `}
                  {data.competitor.reviewCount != null && `(${data.competitor.reviewCount} reviews)`}
                </p>
                {data.competitor.website && (
                  <a
                    href={data.competitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Website
                  </a>
                )}
              </div>

              {data.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.badges.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-medium dark:bg-zinc-800"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}

              <section className="space-y-3">
                <h4 className="font-semibold">Strength profile</h4>
                <StrengthBar label="Reviews" value={data.strengthScores.reviews} />
                <StrengthBar label="Review velocity" value={data.strengthScores.velocity} />
                <StrengthBar label="Proximity" value={data.strengthScores.proximity} />
                <StrengthBar label="GBP relevance" value={data.strengthScores.gbpRelevance} />
                <StrengthBar label="Website" value={data.strengthScores.website} />
                <StrengthBar label="Citations / links" value={data.strengthScores.authority} />
              </section>

              {data.mapStats.totalCells > 0 && (
                <section className="rounded-lg border border-border p-3 dark:border-zinc-800">
                  <h4 className="font-semibold">Map summary</h4>
                  <ul className="mt-2 space-y-1 text-text-muted dark:text-text-muted">
                    <li>SoLV: {data.mapStats.solv}%</li>
                    <li>Avg rank: #{rankLabel(data.mapStats.avgRank)}</li>
                    <li>
                      Top 3: {data.mapStats.top3Cells}/{data.mapStats.totalCells} cells
                    </li>
                    {data.mapStats.strongestArea && <li>Strongest: {data.mapStats.strongestArea}</li>}
                    {data.mapStats.weakestArea && <li>Weakest: {data.mapStats.weakestArea}</li>}
                  </ul>
                </section>
              )}

              <section>
                <h4 className="font-semibold">Evidence</h4>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {data.evidence.reviewsLast30Days != null && (
                    <>
                      <dt className="text-text-muted">30-day reviews</dt>
                      <dd>{data.evidence.reviewsLast30Days}</dd>
                    </>
                  )}
                  {data.evidence.citationCount != null && (
                    <>
                      <dt className="text-text-muted">Citations</dt>
                      <dd>{data.evidence.citationCount}</dd>
                    </>
                  )}
                  {data.evidence.referringDomains != null && (
                    <>
                      <dt className="text-text-muted">Referring domains</dt>
                      <dd>{data.evidence.referringDomains}</dd>
                    </>
                  )}
                </dl>
              </section>

              <div className="flex flex-wrap gap-2">
                {key && onShowGrid && (
                  <button
                    type="button"
                    onClick={() => onShowGrid(key)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-subtle dark:border-zinc-700"
                  >
                    Show their grid
                  </button>
                )}
                {key && onCompare && (
                  <button
                    type="button"
                    onClick={() => onCompare(key)}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Compare against me
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
