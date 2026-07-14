"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { generateGrid } from "@/lib/maps/grid";
import { gridScanMeta } from "@/lib/maps/grid-metrics";
import { cn } from "@/lib/utils";

/**
 * Static (no Google Maps) geographic grid preview.
 * Bubbles are projected from generateGrid so spacing matches the real scan.
 * Click a bubble to include/exclude it before running.
 */
export function GridPreviewCanvas({
  centerLat,
  centerLng,
  gridSize,
  radiusMeters,
  excludedLabels,
  onToggleLabel,
  className,
}: {
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusMeters: number;
  excludedLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  className?: string;
}) {
  const meta = gridScanMeta(gridSize, radiusMeters);
  const points = useMemo(
    () => generateGrid({ centerLat, centerLng, gridSize, radiusMeters }),
    [centerLat, centerLng, gridSize, radiusMeters]
  );

  const included = points.length - excludedLabels.size;
  // Padding so edge bubbles sit inside the frame
  const view = 100;
  const pad = 8;
  const usable = view - pad * 2;
  const span = Math.max(gridSize - 1, 1);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100", className)}>
      {/* Decorative map-like backdrop — no live Google Maps tiles */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(180deg, rgba(236, 253, 245, 0.55), rgba(241, 245, 249, 0.85)),
            radial-gradient(ellipse at 30% 20%, rgba(167, 243, 208, 0.35), transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(186, 230, 253, 0.4), transparent 45%),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 18px,
              rgba(148, 163, 184, 0.12) 18px,
              rgba(148, 163, 184, 0.12) 19px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 18px,
              rgba(148, 163, 184, 0.12) 18px,
              rgba(148, 163, 184, 0.12) 19px
            )
          `,
          backgroundColor: "#e8eef3",
        }}
      />
      {/* Soft “roads” */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 42 H100" stroke="#94a3b8" strokeWidth="0.6" fill="none" />
        <path d="M0 58 H100" stroke="#94a3b8" strokeWidth="0.45" fill="none" />
        <path d="M38 0 V100" stroke="#94a3b8" strokeWidth="0.55" fill="none" />
        <path d="M62 0 V100" stroke="#cbd5e1" strokeWidth="0.4" fill="none" />
        <path d="M10 90 Q50 70 90 20" stroke="#a7f3d0" strokeWidth="1.2" fill="none" opacity="0.5" />
      </svg>

      <div className="relative aspect-square w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[440px]">
        <svg viewBox={`0 0 ${view} ${view}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Scan grid preview">
          {points.map((p) => {
            const excluded = excludedLabels.has(p.label);
            const x = pad + (p.col / span) * usable;
            const y = pad + (p.row / span) * usable;
            const r = Math.max(1.8, Math.min(3.6, usable / (gridSize * 2.4)));
            return (
              <g key={p.label}>
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={excluded ? "#ffffff" : "#3b82f6"}
                  stroke={excluded ? "#94a3b8" : "#1d4ed8"}
                  strokeWidth={0.45}
                  className="cursor-pointer transition-[fill,stroke] hover:opacity-90"
                  onClick={() => onToggleLabel(p.label)}
                >
                  <title>
                    {excluded ? `Include ${p.label}` : `Exclude ${p.label}`}
                  </title>
                </circle>
              </g>
            );
          })}
          {/* Center pin */}
          <g>
            <circle cx={view / 2} cy={view / 2} r={2.2} fill="#059669" stroke="#fff" strokeWidth={0.5} />
            <circle cx={view / 2} cy={view / 2} r={4} fill="none" stroke="#059669" strokeWidth={0.35} opacity={0.5} />
          </g>
        </svg>

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200/80">
          <MapPin className="h-3 w-3 text-emerald-600" />
          Preview · not billed yet
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] text-zinc-600 shadow-sm ring-1 ring-zinc-200/80">
          <span>
            {meta.gridSize}×{meta.gridSize} · {meta.radiusMiles} mi · ~{meta.spacingMiles} mi spacing
          </span>
          <span className="font-semibold text-zinc-800">
            {included}/{points.length} points · {included} credits
          </span>
        </div>
      </div>
    </div>
  );
}
