"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import type { ScanHistoryEntry } from "@/lib/maps/scan-history";

interface GridScanTrendChartProps {
  businessId: string;
  currentScanId: string;
  keywordId?: string | null;
  locationId?: string | null;
  gridSize?: number;
  radiusMeters?: number;
  className?: string;
}

export function GridScanTrendChart({
  businessId,
  currentScanId,
  keywordId,
  locationId,
  gridSize,
  radiusMeters,
  className = "",
}: GridScanTrendChartProps) {
  const [scans, setScans] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ businessId, mode: "target" });
      if (keywordId) params.set("keywordId", keywordId);
      if (locationId) params.set("locationId", locationId);
      if (gridSize) params.set("gridSize", String(gridSize));
      if (radiusMeters) params.set("radius", String(radiusMeters));

      const res = await fetch(`/api/scans/history?${params}`);
      const json = await res.json();
      if (!res.ok) return;
      setScans((json.scans ?? []) as ScanHistoryEntry[]);
    } finally {
      setLoading(false);
    }
  }, [businessId, keywordId, locationId, gridSize, radiusMeters]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, currentScanId]);

  const chartData = scans.map((s) => ({
    date: new Date(s.completed_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    avgRank: s.avg_rank,
    solv: s.solv,
    scanId: s.scan_id,
  }));

  return (
    <div className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      <h3 className="text-sm font-semibold text-zinc-900">Compare over time</h3>
      {loading && !chartData.length ? (
        <div className="mt-4 flex h-40 items-center justify-center text-sm text-text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : chartData.length < 2 ? (
        <p className="mt-3 text-sm text-text-muted">Run at least two scans to see trends.</p>
      ) : (
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} />
              <YAxis yAxisId="rank" orientation="left" tick={{ fontSize: 11, fill: "#71717a" }} reversed />
              <YAxis yAxisId="solv" orientation="right" tick={{ fontSize: 11, fill: "#71717a" }} unit="%" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e4e4e7",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="rank"
                type="monotone"
                dataKey="avgRank"
                name="Avg Rank"
                stroke="#16A34A"
                strokeWidth={2}
                dot={{ r: 3, fill: "#16A34A" }}
                connectNulls
              />
              <Line
                yAxisId="solv"
                type="monotone"
                dataKey="solv"
                name="SoLV"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
