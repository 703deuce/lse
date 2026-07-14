"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { generateGrid } from "@/lib/maps/grid";
import { gridScanMeta } from "@/lib/maps/grid-metrics";
import { loadGoogleMaps } from "@/lib/maps/load-google-maps";
import { useGoogleMapsApiKey } from "@/components/maps/google-maps-key-context";
import { officePinIcon } from "@/components/maps/map-pin-icons";
import { cn } from "@/lib/utils";

function bubbleIcon(g: typeof google, excluded: boolean, size = 28): google.maps.Icon {
  const fill = excluded ? "#ffffff" : "#3b82f6";
  const stroke = excluded ? "#94a3b8" : "#1d4ed8";
  const r = size / 2 - 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new g.maps.Size(size, size),
    anchor: new g.maps.Point(size / 2, size / 2),
  };
}

function gridFitZoom(lat: number, radiusMeters: number, mapPx: number): number {
  const gridSpanM = radiusMeters * 2 * 1.05;
  const usablePx = Math.max(mapPx * 0.78, 160);
  const metersPerPixel = gridSpanM / usablePx;
  const latRad = (lat * Math.PI) / 180;
  const zoom = Math.log2((40075016 * Math.cos(latRad)) / (256 * metersPerPixel));
  return Math.min(16, Math.max(9, Math.round(zoom * 100) / 100));
}

/**
 * Live Google Map preview of the scan grid.
 * Bubbles toggle include/exclude before Run scan. Recenters when location changes.
 */
export function GridPreviewCanvas({
  centerLat,
  centerLng,
  gridSize,
  radiusMeters,
  excludedLabels,
  onToggleLabel,
  locationLabel,
  className,
}: {
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusMeters: number;
  excludedLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  locationLabel?: string | null;
  className?: string;
}) {
  const apiKey = useGoogleMapsApiKey();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const officeRef = useRef<google.maps.Marker | null>(null);
  const gRef = useRef<typeof google | null>(null);
  const onToggleRef = useRef(onToggleLabel);
  onToggleRef.current = onToggleLabel;
  const excludedRef = useRef(excludedLabels);
  excludedRef.current = excludedLabels;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const meta = gridScanMeta(gridSize, radiusMeters);
  const points = useMemo(
    () => generateGrid({ centerLat, centerLng, gridSize, radiusMeters }),
    [centerLat, centerLng, gridSize, radiusMeters]
  );
  const included = points.length - excludedLabels.size;

  // Init map once
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!apiKey) {
        setStatus("error");
        setError("Missing Google Maps API key.");
        return;
      }
      if (!containerRef.current) return;

      try {
        const g = await loadGoogleMaps(apiKey);
        if (cancelled || !containerRef.current) return;
        gRef.current = g;

        const map = new g.maps.Map(containerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        mapRef.current = map;

        officeRef.current = new g.maps.Marker({
          map,
          position: { lat: centerLat, lng: centerLng },
          icon: officePinIcon(g),
          zIndex: 1000,
          title: locationLabel ?? "Scan center",
        });

        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load Google Maps");
      }
    }

    void init();

    return () => {
      cancelled = true;
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
      officeRef.current?.setMap(null);
      officeRef.current = null;
      mapRef.current = null;
      gRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per apiKey
  }, [apiKey]);

  // Sync center, bubbles, and fit when geometry or exclusions change
  useEffect(() => {
    const map = mapRef.current;
    const g = gRef.current;
    if (!map || !g || status !== "ready") return;

    officeRef.current?.setPosition({ lat: centerLat, lng: centerLng });
    officeRef.current?.setTitle(locationLabel ?? "Scan center");

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const pinSize = gridSize >= 9 ? 22 : gridSize >= 7 ? 26 : 30;

    for (const p of points) {
      const excluded = excludedRef.current.has(p.label);
      const marker = new g.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        icon: bubbleIcon(g, excluded, pinSize),
        title: excluded ? `Include ${p.label}` : `Exclude ${p.label}`,
        zIndex: excluded ? 1 : 10,
        opacity: excluded ? 0.85 : 1,
      });
      marker.addListener("click", () => {
        onToggleRef.current(p.label);
      });
      markersRef.current.push(marker);
    }

    const el = containerRef.current;
    const mapPx = Math.min(el?.clientWidth ?? 480, el?.clientHeight ?? 480);
    const zoom = gridFitZoom(centerLat, radiusMeters, mapPx);
    map.setCenter({ lat: centerLat, lng: centerLng });
    map.setZoom(zoom);
  }, [centerLat, centerLng, points, excludedLabels, gridSize, radiusMeters, locationLabel, status]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100", className)}>
      <div className="relative aspect-square w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[440px]">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/90">
            {status === "error" ? (
              <p className="max-w-xs px-4 text-center text-[13px] text-red-600">{error ?? "Map unavailable"}</p>
            ) : (
              <span className="inline-flex items-center gap-2 text-[13px] text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading map…
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[70%] items-center gap-1.5 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200/80">
          <MapPin className="h-3 w-3 shrink-0 text-emerald-600" />
          <span className="truncate">{locationLabel?.trim() || "Preview · not billed yet"}</span>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/95 px-2.5 py-1.5 text-[11px] text-zinc-600 shadow-sm ring-1 ring-zinc-200/80">
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
