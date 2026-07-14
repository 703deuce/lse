"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type GridColorMode } from "@/lib/maps/colors";
import { formatRingMilesLabel } from "@/lib/maps/grid-metrics";
import { loadGoogleMaps } from "@/lib/maps/load-google-maps";
import { useGoogleMapsApiKey } from "@/components/maps/google-maps-key-context";
import {
  cellPinIcon,
  officePinIcon,
  previewPinIcon,
  spotCheckPinIcon,
} from "@/components/maps/map-pin-icons";
import type { SpotCheckMarker } from "@/components/scan/single-point-check";

export type MapInteractionMode = "default" | "move-grid" | "single-point";

export interface GridCell {
  label: string;
  lat: number;
  lng: number;
  rank: number | null;
  pending?: boolean;
  failed?: boolean;
  notInResults?: boolean;
  pointId?: string;
  delta?: number | null;
  direction?: "improved" | "declined" | "unchanged" | "missing";
  dimmed?: boolean;
}

interface ScanMapProps {
  officeCenter: [number, number];
  cells: GridCell[];
  businessName?: string;
  height?: string;
  colorMode?: GridColorMode;
  onCellClick?: (cell: GridCell) => void;
  showDeltaOverlay?: boolean;
  interactionMode?: MapInteractionMode;
  previewCenter?: [number, number];
  previewCells?: GridCell[];
  onPreviewCenterChange?: (lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  cellsFaded?: boolean;
  spotChecks?: SpotCheckMarker[];
  onSpotCheckClick?: (id: string) => void;
  showRadiusRings?: boolean;
  radiusCenter?: [number, number];
  radiusRingMiles?: number[];
  gridSize?: number;
  radiusMeters?: number;
  syncEnabled?: boolean;
  syncView?: { lat: number; lng: number; zoom: number } | null;
  onSyncViewChange?: (view: { lat: number; lng: number; zoom: number }) => void;
  syncZoom?: boolean;
  resetViewKey?: number;
}

const MAP_FIT_MAX_ZOOM = 16;
const METERS_PER_MILE = 1609.344;

function gridFitZoom(lat: number, radiusMeters: number, mapPx: number): number {
  const gridSpanM = radiusMeters * 2 * 1.02;
  const usablePx = Math.max(mapPx * 0.78, 160);
  const metersPerPixel = gridSpanM / usablePx;
  const latRad = (lat * Math.PI) / 180;
  const zoom = Math.log2((40075016 * Math.cos(latRad)) / (256 * metersPerPixel));
  return Math.min(MAP_FIT_MAX_ZOOM, Math.max(9, Math.round(zoom * 100) / 100));
}

function cellPopupText(cell: GridCell): string {
  if (cell.failed) return `${cell.label}: Scan failed for this location`;
  if (cell.pending) return `${cell.label}: Scanning…`;
  if (cell.notInResults) return `${cell.label}: Not in local pack (rank 20+)`;
  if (cell.rank != null) return `${cell.label}: Rank #${cell.rank}`;
  return `${cell.label}: Not in top results`;
}

export function ScanMap({
  officeCenter,
  cells,
  businessName,
  height = "min(72vh, 640px)",
  colorMode = "falcon",
  onCellClick,
  showDeltaOverlay,
  interactionMode = "default",
  previewCenter,
  previewCells = [],
  onPreviewCenterChange,
  onMapClick,
  cellsFaded,
  spotChecks = [],
  onSpotCheckClick,
  showRadiusRings = false,
  radiusCenter,
  radiusRingMiles = [],
  gridSize,
  radiusMeters,
  syncEnabled,
  syncView,
  onSyncViewChange,
  syncZoom = true,
  resetViewKey,
}: ScanMapProps) {
  const apiKey = useGoogleMapsApiKey();
  const mapKey = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const ringsRef = useRef<google.maps.Circle[]>([]);
  const ringLabelsRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const applyingSync = useRef(false);
  const lastFitKey = useRef("");
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const propsRef = useRef({
    officeCenter,
    cells,
    businessName,
    colorMode,
    onCellClick,
    showDeltaOverlay,
    interactionMode,
    previewCenter,
    previewCells,
    onPreviewCenterChange,
    onMapClick,
    cellsFaded,
    spotChecks,
    onSpotCheckClick,
    showRadiusRings,
    radiusCenter,
    radiusRingMiles,
    gridSize,
    radiusMeters,
    syncEnabled,
    syncView,
    onSyncViewChange,
    syncZoom,
    resetViewKey,
  });
  propsRef.current = {
    officeCenter,
    cells,
    businessName,
    colorMode,
    onCellClick,
    showDeltaOverlay,
    interactionMode,
    previewCenter,
    previewCells,
    onPreviewCenterChange,
    onMapClick,
    cellsFaded,
    spotChecks,
    onSpotCheckClick,
    showRadiusRings,
    radiusCenter,
    radiusRingMiles,
    gridSize,
    radiusMeters,
    syncEnabled,
    syncView,
    onSyncViewChange,
    syncZoom,
    resetViewKey,
  };

  function clearOverlays() {
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    for (const c of ringsRef.current) c.setMap(null);
    ringsRef.current = [];
    for (const l of ringLabelsRef.current) l.setMap(null);
    ringLabelsRef.current = [];
  }

  function fitMap(map: google.maps.Map, g: typeof google) {
    const p = propsRef.current;
    const center = p.previewCenter ?? p.officeCenter;
    const fitKey =
      p.gridSize && p.radiusMeters
        ? `${center[0].toFixed(5)},${center[1].toFixed(5)},${p.gridSize},${p.radiusMeters},${p.resetViewKey ?? 0}`
        : `${center[0].toFixed(5)},${center[1].toFixed(5)},cells:${p.cells.length},${p.resetViewKey ?? 0}`;
    if (lastFitKey.current === fitKey) return;

    const div = map.getDiv();
    const mapPx = Math.min(div.clientWidth || 0, div.clientHeight || 0);
    if (mapPx < 20) return;

    if (p.gridSize && p.radiusMeters && p.gridSize >= 3) {
      const zoom = gridFitZoom(center[0], p.radiusMeters, mapPx);
      map.setCenter({ lat: center[0], lng: center[1] });
      map.setZoom(zoom);
      lastFitKey.current = fitKey;
      return;
    }

    const points = [...p.cells, ...p.previewCells];
    if (points.length === 0) {
      map.setCenter({ lat: center[0], lng: center[1] });
      map.setZoom(14);
      lastFitKey.current = fitKey;
      return;
    }

    const bounds = new g.maps.LatLngBounds();
    for (const c of points) bounds.extend({ lat: c.lat, lng: c.lng });
    bounds.extend({ lat: center[0], lng: center[1] });
    map.fitBounds(bounds, 20);
    const z = map.getZoom();
    if (z != null && z > MAP_FIT_MAX_ZOOM) map.setZoom(MAP_FIT_MAX_ZOOM);
    lastFitKey.current = fitKey;
  }

  function renderOverlays(map: google.maps.Map, g: typeof google) {
    const p = propsRef.current;
    clearOverlays();
    infoRef.current?.close();

    const center = p.previewCenter ?? p.officeCenter;
    const ringCenter = p.radiusCenter ?? p.officeCenter;

    if (p.showRadiusRings && p.radiusRingMiles.length > 0) {
      p.radiusRingMiles.forEach((miles, index) => {
        const isOuter = index === p.radiusRingMiles.length - 1;
        const radius = miles * METERS_PER_MILE;
        const circle = new g.maps.Circle({
          map,
          center: { lat: ringCenter[0], lng: ringCenter[1] },
          radius,
          strokeColor: "#2563eb",
          strokeOpacity: isOuter ? 0.7 : 0.55 - index * 0.05,
          strokeWeight: isOuter ? 2 : 1.5,
          fillColor: "#2563eb",
          fillOpacity: 0.03,
          clickable: false,
        });
        ringsRef.current.push(circle);

        const labelPos = g.maps.geometry?.spherical?.computeOffset
          ? g.maps.geometry.spherical.computeOffset(
              new g.maps.LatLng(ringCenter[0], ringCenter[1]),
              radius,
              90
            )
          : { lat: ringCenter[0], lng: ringCenter[1] + radius / 111320 };

        const labelText = `${formatRingMilesLabel(miles)}${isOuter ? " · edge pins" : ""}`;
        const label = new g.maps.Marker({
          map,
          position: labelPos,
          clickable: false,
          zIndex: 10,
          icon: {
            url:
              "data:image/svg+xml;charset=UTF-8," +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="transparent"/></svg>`
              ),
            scaledSize: new g.maps.Size(1, 1),
          },
          label: {
            text: labelText,
            color: "#1e40af",
            fontSize: "11px",
            fontWeight: "600",
            className: "gmaps-ring-label",
          },
        });
        ringLabelsRef.current.push(label);
      });
    }

    const office =
      p.interactionMode === "move-grid" && p.onPreviewCenterChange
        ? new g.maps.Marker({
            map,
            position: { lat: center[0], lng: center[1] },
            icon: officePinIcon(g),
            draggable: true,
            zIndex: 2000,
            title: p.businessName ?? "New grid center",
          })
        : new g.maps.Marker({
            map,
            position: { lat: p.officeCenter[0], lng: p.officeCenter[1] },
            icon: officePinIcon(g),
            clickable: false,
            zIndex: 500,
            title: p.businessName ?? "Your business",
          });
    markersRef.current.push(office);

    if (p.interactionMode === "move-grid" && p.onPreviewCenterChange) {
      office.addListener("dragend", () => {
        const ll = office.getPosition();
        if (!ll) return;
        p.onPreviewCenterChange?.(ll.lat(), ll.lng());
      });
    } else {
      office.addListener("click", () => {
        infoRef.current?.setContent(
          `<div style="font-size:13px"><strong>${p.businessName ?? "Your business"}</strong><br/><span style="color:#71717a;font-size:12px">Office location (grid center)</span></div>`
        );
        infoRef.current?.open({ map, anchor: office });
      });
    }

    for (const cell of p.cells) {
      const deltaOverlay =
        p.showDeltaOverlay && cell.direction
          ? { delta: cell.delta ?? null, direction: cell.direction }
          : undefined;
      const marker = new g.maps.Marker({
        map,
        position: { lat: cell.lat, lng: cell.lng },
        icon: cellPinIcon(g, cell.rank, p.colorMode, {
          pending: cell.pending,
          notInResults: cell.notInResults,
          failed: cell.failed,
          faded: cell.dimmed || p.cellsFaded,
          deltaOverlay,
        }),
        zIndex: 1000,
        title: cellPopupText(cell),
      });
      marker.addListener("click", () => {
        if (p.interactionMode !== "default") return;
        infoRef.current?.setContent(
          `<div style="font-size:13px">${cellPopupText(cell)}</div>`
        );
        infoRef.current?.open({ map, anchor: marker });
        p.onCellClick?.(cell);
      });
      markersRef.current.push(marker);
    }

    for (const cell of p.previewCells) {
      markersRef.current.push(
        new g.maps.Marker({
          map,
          position: { lat: cell.lat, lng: cell.lng },
          icon: previewPinIcon(g),
          clickable: false,
          zIndex: 800,
        })
      );
    }

    for (const sc of p.spotChecks) {
      const marker = new g.maps.Marker({
        map,
        position: { lat: sc.lat, lng: sc.lng },
        icon: spotCheckPinIcon(g, sc.rank, p.colorMode),
        zIndex: 3000,
        title: `${sc.keyword}: ${sc.rank != null ? `#${sc.rank}` : "20+"}`,
      });
      marker.addListener("click", (e: google.maps.MapMouseEvent) => {
        e.domEvent?.stopPropagation();
        p.onSpotCheckClick?.(sc.id);
        infoRef.current?.setContent(
          `<div style="font-size:13px">${sc.keyword}: ${sc.rank != null ? `#${sc.rank}` : "20+"}<br/><span style="font-size:12px;color:#71717a">${new Date(sc.checkedAt).toLocaleString()}</span></div>`
        );
        infoRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
    }

    map.setOptions({
      draggableCursor: p.interactionMode === "single-point" ? "crosshair" : undefined,
    });
  }

  // Initialize map once key is available
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!apiKey) {
        setStatus("error");
        setError("Missing Google Maps API key (set MAPS in Coolify).");
        return;
      }
      if (!containerRef.current) return;

      try {
        const g = await loadGoogleMaps(apiKey);
        if (cancelled || !containerRef.current) return;

        for (const l of listenersRef.current) l.remove();
        listenersRef.current = [];
        clearOverlays();
        mapRef.current = null;

        lastFitKey.current = "";
        const map = new g.maps.Map(containerRef.current, {
          center: {
            lat: (propsRef.current.previewCenter ?? propsRef.current.officeCenter)[0],
            lng: (propsRef.current.previewCenter ?? propsRef.current.officeCenter)[1],
          },
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        mapRef.current = map;
        infoRef.current = new g.maps.InfoWindow();

        listenersRef.current.push(
          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            const p = propsRef.current;
            if (
              (p.interactionMode === "move-grid" || p.interactionMode === "single-point") &&
              e.latLng
            ) {
              p.onMapClick?.(e.latLng.lat(), e.latLng.lng());
            }
          })
        );

        listenersRef.current.push(
          map.addListener("idle", () => {
            const p = propsRef.current;
            if (!p.syncEnabled || applyingSync.current) return;
            const c = map.getCenter();
            const z = map.getZoom();
            if (!c || z == null) return;
            p.onSyncViewChange?.({ lat: c.lat(), lng: c.lng(), zoom: z });
          })
        );

        renderOverlays(map, g);
        fitMap(map, g);
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
      for (const l of listenersRef.current) l.remove();
      listenersRef.current = [];
      clearOverlays();
      infoRef.current?.close();
      mapRef.current = null;
    };
    // Remount when mapKey-ish mode changes need a fresh map instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mapKey, colorMode, interactionMode]);

  // Re-render overlays / fit / sync when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    renderOverlays(map, window.google);
    fitMap(map, window.google);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    officeCenter,
    cells,
    previewCenter,
    previewCells,
    cellsFaded,
    spotChecks,
    showRadiusRings,
    radiusCenter,
    radiusRingMiles,
    gridSize,
    radiusMeters,
    resetViewKey,
    showDeltaOverlay,
    businessName,
    onCellClick,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !syncEnabled || !syncView || applyingSync.current) return;
    const c = map.getCenter();
    const z = map.getZoom();
    if (!c || z == null) return;
    if (
      Math.abs(c.lat() - syncView.lat) < 1e-7 &&
      Math.abs(c.lng() - syncView.lng) < 1e-7 &&
      (!syncZoom || z === syncView.zoom)
    ) {
      return;
    }
    applyingSync.current = true;
    map.setCenter({ lat: syncView.lat, lng: syncView.lng });
    if (syncZoom) map.setZoom(syncView.zoom);
    applyingSync.current = false;
  }, [syncEnabled, syncView, syncZoom]);

  const cursorStyle = interactionMode === "single-point" ? "crosshair" : undefined;

  return (
    <div
      style={{ height }}
      className="relative w-full overflow-hidden rounded-xl border border-border dark:border-zinc-800"
    >
      <div ref={containerRef} style={{ height: "100%", width: "100%", cursor: cursorStyle }} />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-subtle/80 dark:bg-zinc-900/80">
          <span className="text-sm text-text-muted">
            {status === "error" ? error ?? "Map unavailable" : "Loading map…"}
          </span>
        </div>
      )}
    </div>
  );
}
