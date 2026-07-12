"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type DebugData = {
  scanId: string;
  businessName?: string;
  keyword: string;
  scanProfile: { label: string; device: string; os: string; browser: string };
  gridSize: number;
  radiusMeters: number;
  status: string;
  aggregateMetrics: Record<string, unknown>;
  cells: Array<{
    gridLabel: string;
    lat: number;
    lng: number;
    hasResult: boolean;
    targetRank: number | null;
    matchReason: string | null;
    competitorCount: number;
    request: Record<string, unknown>;
  }>;
};

export function GridScanDebugView({ businessId, scanId }: { businessId: string; scanId: string }) {
  const [data, setData] = useState<DebugData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/scans/${scanId}/debug`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((e) => setError(String(e)));
  }, [scanId]);

  return (
    <>
      <PageHeader
        title="Grid scan debug"
        actions={
          <Link
            href={`/businesses/${businessId}/grid/${scanId}`}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Back to Rank Grid
          </Link>
        }
      />

      {error && <p className="text-red-600">{error}</p>}
      {!data && !error && <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />}
      {data && (
        <div className="space-y-6 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt className="text-zinc-500">Keyword</dt><dd>{data.keyword}</dd></div>
            <div><dt className="text-zinc-500">Profile</dt><dd>{data.scanProfile.label}</dd></div>
            <div><dt className="text-zinc-500">Grid</dt><dd>{data.gridSize}×{data.gridSize} · {data.radiusMeters}m</dd></div>
            <div><dt className="text-zinc-500">Status</dt><dd>{data.status}</dd></div>
          </dl>
          <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="p-2">Cell</th>
                  <th className="p-2">Rank</th>
                  <th className="p-2">Match</th>
                  <th className="p-2">Competitors</th>
                </tr>
              </thead>
              <tbody>
                {data.cells.map((c) => (
                  <tr key={c.gridLabel} className="border-b border-zinc-100">
                    <td className="p-2 font-mono">{c.gridLabel}</td>
                    <td className="p-2">{c.targetRank ?? "—"}</td>
                    <td className="p-2">{c.matchReason ?? "—"}</td>
                    <td className="p-2">{c.competitorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
