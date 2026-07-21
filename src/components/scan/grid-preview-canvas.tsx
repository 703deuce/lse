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
  centerDetail,
  spacingMiles,
  className,
}: {
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusMeters: number;
  excludedLabels: Set<string>;
  onToggleLabel: (label: string) => void;
  locationLabel?: string | null;
  centerDetail?: string | null;
  spacingMiles?: number | null;
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
    <div className={cn("relative overflow-hidden rounded-xl border border-[#E6EAF0] bg-[#F2F4F7]", className)}>
      <div className="relative aspect-square w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[480px]">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />

        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F2F4F7]/95">
            {status === "error" ? (
              <p className="max-w-xs px-4 text-center text-sm text-[#B42318]">
                {error ?? "Map unavailable"}
              </p>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-[#667085]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading map…
              </span>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[75%] items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#344054] shadow-sm ring-1 ring-[#E6EAF0]">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#137752]" />
          <span className="truncate">{locationLabel?.trim() || "Preview · not started"}</span>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 right-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-white/95 px-3.5 py-2.5 text-[11px] shadow-sm ring-1 ring-[#E6EAF0] sm:grid-cols-4">
            <div>
              <p className="font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Grid</p>
              <p className="mt-0.5 font-semibold text-[#101828]">
                {meta.gridSize} × {meta.gridSize}
              </p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Spacing</p>
              <p className="mt-0.5 font-semibold text-[#101828]">
                {(spacingMiles ?? meta.spacingMiles).toFixed(2)} mi
                <span className="font-normal text-[#667085]">
                  {" "}
                  (~{Math.round((spacingMiles ?? meta.spacingMiles) * 1609)} m)
                </span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Center</p>
              <p className="mt-0.5 truncate font-semibold text-[#101828]">
                {(centerDetail ?? locationLabel)?.trim() || "—"}
              </p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Cells included</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-[#101828]">
                <span className="inline-block h-2 w-2 rounded-full bg-[#3b82f6]" />
                {included} / {points.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
