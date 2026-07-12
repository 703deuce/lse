"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { rankPinStyle, type GridColorMode } from "@/lib/maps/colors";
import { generateGrid } from "@/lib/maps/grid";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type { SpotCheckMarker } from "@/components/scan/single-point-check";
import { RadiusRingsLayer } from "@/components/maps/radius-rings-layer";
import type { DivIcon, Marker as LeafletMarker } from "leaflet";

export type MapInteractionMode = "default" | "move-grid" | "single-point";

export interface GridCell {
  label: string;
  lat: number;
  lng: number;
  rank: number | null;
  /** Cell not yet queried — scan still running */
  pending?: boolean;
  /** Cell permanently failed after retries */
  failed?: boolean;
  /** Queried but business not in returned local results */
  notInResults?: boolean;
  /** For cell click handler */
  pointId?: string;
  /** Compare mode delta */
  delta?: number | null;
  direction?: "improved" | "declined" | "unchanged" | "missing";
  /** Dim this cell when another is highlighted */
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
  /** When set, map zoom fits the full scan grid (not just loaded cells). */
  gridSize?: number;
  radiusMeters?: number;
  syncEnabled?: boolean;
  syncView?: { lat: number; lng: number; zoom: number } | null;
  onSyncViewChange?: (view: { lat: number; lng: number; zoom: number }) => void;
  /** When false, linked maps share pan only — each keeps its own zoom for different grid sizes. */
  syncZoom?: boolean;
  resetViewKey?: number;
}

function cellIcon(
  rank: number | null,
  colorMode: GridColorMode,
  pending = false,
  notInResults = false,
  pinSize = 36,
  deltaOverlay?: { delta: number | null; direction?: GridCell["direction"] },
  faded = false,
  failed = false
): DivIcon {
  const L = require("leaflet") as typeof import("leaflet");
  const label = failed ? "✕" : pending ? "…" : notInResults ? "20+" : rankLabel(rank);
  const style = rankPinStyle(rank, colorMode, { pending, notInResults, failed });
  const half = pinSize / 2;
  const fontSize = failed ? 14 : label.length > 2 ? 10 : 12;
  const pulse = pending ? "animation:grid-pulse 1.2s ease-in-out infinite;" : "";
  const opacity = faded ? "opacity:0.35;" : "";
  const bg =
    pending || failed || notInResults ? style.baseHex : style.background;

  let deltaHtml = "";
  if (deltaOverlay?.direction && deltaOverlay.direction !== "missing") {
    const arrow =
      deltaOverlay.direction === "improved"
        ? "▲"
        : deltaOverlay.direction === "declined"
          ? "▼"
          : "•";
    const deltaColor =
      deltaOverlay.direction === "improved"
        ? "#16a34a"
        : deltaOverlay.direction === "declined"
          ? "#dc2626"
          : "#71717a";
    deltaHtml = `<div style="position:absolute;top:-4px;right:-4px;font-size:9px;color:${deltaColor};font-weight:700;text-shadow:0 0 2px #fff">${arrow}</div>`;
  }

  return L.divIcon({
    className: "",
    html: `<div style="position:relative;${opacity}background:${bg};width:${pinSize}px;height:${pinSize}px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.28),inset 0 -1px 2px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:${style.color};${pulse}">${label}${deltaHtml}</div>`,
    iconSize: [pinSize, pinSize],
    iconAnchor: [half, half],
  });
}

function previewCellIcon(): DivIcon {
  const L = require("leaflet") as typeof import("leaflet");
  return L.divIcon({
    className: "",
    html: `<div style="background:rgba(37,99,235,0.25);width:28px;height:28px;border-radius:50%;border:2px dashed #2563eb;box-shadow:0 1px 3px rgba(0,0,0,.15)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function spotCheckIcon(rank: number | null, colorMode: GridColorMode): DivIcon {
  const L = require("leaflet") as typeof import("leaflet");
  const label = rank != null ? rankLabel(rank) : "20+";
  const style = rankPinStyle(rank, colorMode, { notInResults: rank == null });
  const fontSize = label.length > 2 ? 9 : 11;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:38px;height:44px">
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:10px;height:10px;background:#f59e0b;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>
      <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:${style.background};width:34px;height:34px;border-radius:50%;border:3px solid #f59e0b;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:${style.color}">${label}</div>
    </div>`,
    iconSize: [38, 44],
    iconAnchor: [19, 44],
  });
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function DraggableCenterMarker({
  position,
  businessName,
  onMove,
}: {
  position: [number, number];
  businessName?: string;
  onMove: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={officeIcon()}
      draggable
      zIndexOffset={2000}
      eventHandlers={{
        dragend: () => {
          const ll = markerRef.current?.getLatLng();
          if (ll) onMove(ll.lat, ll.lng);
        },
      }}
    >
      <Popup>
        <strong>{businessName ?? "New grid center"}</strong>
        <br />
        <span className="text-xs text-text-muted">Drag to move center</span>
      </Popup>
    </Marker>
  );
}

function officeIcon(): DivIcon {
  const L = require("leaflet") as typeof import("leaflet");
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:40px;height:40px">
      <div style="position:absolute;left:50%;top:4px;transform:translateX(-50%);width:22px;height:22px;background:#2563eb;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:translateX(-50%) rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>
      <div style="position:absolute;left:50%;top:13px;transform:translateX(-50%) rotate(45deg);width:8px;height:8px;background:#fff;border-radius:50%"></div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 36],
  });
}

const MAP_FIT_PADDING: [number, number] = [20, 20];
const MAP_FIT_MAX_ZOOM = 16;

/** Leaflet zoom so grid diameter + small margin fills the map panel. */
function gridFitZoom(lat: number, radiusMeters: number, mapPx: number): number {
  const gridSpanM = radiusMeters * 2 * 1.02;
  const usablePx = Math.max(mapPx * 0.78, 160);
  const metersPerPixel = gridSpanM / usablePx;
  const latRad = (lat * Math.PI) / 180;
  const zoom = Math.log2((40075016 * Math.cos(latRad)) / (256 * metersPerPixel));
  return Math.min(MAP_FIT_MAX_ZOOM, Math.max(9, Math.round(zoom * 100) / 100));
}

function MapViewSync({
  enabled,
  syncView,
  onSyncViewChange,
  syncZoom = true,
}: {
  enabled: boolean;
  syncView?: { lat: number; lng: number; zoom: number } | null;
  onSyncViewChange?: (view: { lat: number; lng: number; zoom: number }) => void;
  syncZoom?: boolean;
}) {
  const map = useMap();
  const applying = useRef(false);

  useMapEvents({
    moveend: () => {
      if (!enabled || applying.current) return;
      const c = map.getCenter();
      onSyncViewChange?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    },
    zoomend: () => {
      if (!enabled || !syncZoom || applying.current) return;
      const c = map.getCenter();
      onSyncViewChange?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    },
  });

  useEffect(() => {
    if (!enabled || !syncView) return;
    const c = map.getCenter();
    const zoom = syncZoom ? syncView.zoom : map.getZoom();
    if (
      Math.abs(c.lat - syncView.lat) < 1e-7 &&
      Math.abs(c.lng - syncView.lng) < 1e-7 &&
      (!syncZoom || map.getZoom() === syncView.zoom)
    ) {
      return;
    }
    applying.current = true;
    map.setView([syncView.lat, syncView.lng], zoom, { animate: false });
    applying.current = false;
  }, [enabled, syncView, syncZoom, map]);

  return null;
}

function FitGridBounds({
  cells,
  officeCenter,
  gridSize,
  radiusMeters,
  resetViewKey,
}: {
  cells: GridCell[];
  officeCenter: [number, number];
  gridSize?: number;
  radiusMeters?: number;
  resetViewKey?: number;
}) {
  const map = useMap();
  const lastFitKey = useRef("");

  useEffect(() => {
    const fitKey =
      gridSize && radiusMeters
        ? `${officeCenter[0].toFixed(5)},${officeCenter[1].toFixed(5)},${gridSize},${radiusMeters},${resetViewKey ?? 0}`
        : `${officeCenter[0].toFixed(5)},${officeCenter[1].toFixed(5)},cells:${cells.length},${resetViewKey ?? 0}`;
    if (lastFitKey.current === fitKey) return;

    const runFit = () => {
      const L = require("leaflet") as typeof import("leaflet");
      map.invalidateSize({ animate: false });
      const size = map.getSize();
      if (size.x < 20 || size.y < 20) return;

      let bounds: import("leaflet").LatLngBounds | null = null;

      if (gridSize && radiusMeters && gridSize >= 3) {
        const points = generateGrid({
          centerLat: officeCenter[0],
          centerLng: officeCenter[1],
          gridSize,
          radiusMeters,
        });
        bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      } else if (cells.length > 0) {
        bounds = L.latLngBounds(cells.map((c) => [c.lat, c.lng] as [number, number]));
        bounds.extend(officeCenter);
      }

      if (!bounds) return;

      if (gridSize && radiusMeters) {
        const zoom = gridFitZoom(officeCenter[0], radiusMeters, Math.min(size.x, size.y));
        map.setView(officeCenter, zoom, { animate: false });
      } else {
        map.fitBounds(bounds, { padding: MAP_FIT_PADDING, maxZoom: MAP_FIT_MAX_ZOOM, animate: false });
      }

      lastFitKey.current = fitKey;
    };

    map.whenReady(runFit);
    const t = window.setTimeout(runFit, 100);

    return () => {
      window.clearTimeout(t);
    };
  }, [cells, officeCenter, gridSize, radiusMeters, map, resetViewKey]);

  return null;
}

function RankMarker({
  cell,
  colorMode,
  onCellClick,
  showDeltaOverlay,
  faded,
}: {
  cell: GridCell;
  colorMode: GridColorMode;
  onCellClick?: (cell: GridCell) => void;
  showDeltaOverlay?: boolean;
  faded?: boolean;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const deltaOverlay =
    showDeltaOverlay && cell.direction
      ? { delta: cell.delta ?? null, direction: cell.direction }
      : undefined;
  const isDimmed = cell.dimmed || faded;

  useEffect(() => {
    markerRef.current?.setIcon(
      cellIcon(cell.rank, colorMode, cell.pending, cell.notInResults, 36, deltaOverlay, isDimmed, cell.failed)
    );
  }, [cell.rank, cell.pending, cell.failed, cell.notInResults, colorMode, cell.delta, cell.direction, showDeltaOverlay, isDimmed]);

  return (
    <Marker
      ref={markerRef}
      position={[cell.lat, cell.lng]}
      icon={cellIcon(cell.rank, colorMode, cell.pending, cell.notInResults, 36, deltaOverlay, isDimmed, cell.failed)}
      zIndexOffset={1000}
      eventHandlers={{
        click: () => onCellClick?.(cell),
      }}
    >
      <Popup>
        {cell.failed
          ? `${cell.label}: Scan failed for this location`
          : cell.pending
          ? `${cell.label}: Scanning…`
          : cell.notInResults
            ? `${cell.label}: Not in local pack (rank 20+)`
            : cell.rank != null
              ? `${cell.label}: Rank #${cell.rank}`
              : `${cell.label}: Not in top results`}
        {onCellClick && (
          <>
            <br />
            <button
              type="button"
              className="mt-1 text-xs text-primary underline"
              onClick={() => onCellClick(cell)}
            >
              Inspect cell
            </button>
          </>
        )}
      </Popup>
    </Marker>
  );
}

function RankMarkers({
  cells,
  colorMode,
  onCellClick,
  showDeltaOverlay,
  faded,
}: {
  cells: GridCell[];
  colorMode: GridColorMode;
  onCellClick?: (cell: GridCell) => void;
  showDeltaOverlay?: boolean;
  faded?: boolean;
}) {
  return (
    <>
      {cells.map((cell) => (
        <RankMarker
          key={cell.label}
          cell={cell}
          colorMode={colorMode}
          onCellClick={onCellClick}
          showDeltaOverlay={showDeltaOverlay}
          faded={faded}
        />
      ))}
    </>
  );
}

function LeafletMap({
  officeCenter,
  cells,
  businessName,
  mapKey,
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
  syncZoom,
  resetViewKey,
}: ScanMapProps & { mapKey: string; colorMode?: GridColorMode }) {
  const center = previewCenter ?? officeCenter;
  const ringCenter = radiusCenter ?? officeCenter;
  const cursorStyle =
    interactionMode === "single-point" ? "crosshair" : undefined;

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={14}
      style={{ height: "100%", width: "100%", cursor: cursorStyle }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RadiusRingsLayer
        center={ringCenter}
        ringsMiles={radiusRingMiles}
        visible={showRadiusRings}
      />
      {(onMapClick || interactionMode !== "default") && (
        <MapClickHandler
          onMapClick={
            interactionMode === "move-grid" || interactionMode === "single-point"
              ? onMapClick
              : undefined
          }
        />
      )}
      <FitGridBounds
        cells={[...cells, ...previewCells]}
        officeCenter={center}
        gridSize={gridSize}
        radiusMeters={radiusMeters}
        resetViewKey={resetViewKey}
      />
      {syncEnabled && (
        <MapViewSync
          enabled={syncEnabled}
          syncView={syncView}
          onSyncViewChange={onSyncViewChange}
          syncZoom={syncZoom}
        />
      )}
      {interactionMode === "move-grid" && onPreviewCenterChange ? (
        <DraggableCenterMarker
          position={center}
          businessName={businessName}
          onMove={onPreviewCenterChange}
        />
      ) : (
        <Marker
          position={officeCenter}
          icon={officeIcon()}
          zIndexOffset={500}
          interactive={false}
        >
          <Popup>
            <strong>{businessName ?? "Your business"}</strong>
            <br />
            <span className="text-xs text-text-muted">Office location (grid center)</span>
          </Popup>
        </Marker>
      )}
      <RankMarkers
        cells={cells}
        colorMode={colorMode}
        onCellClick={interactionMode === "default" ? onCellClick : undefined}
        showDeltaOverlay={showDeltaOverlay}
        faded={cellsFaded}
      />
      {previewCells.map((cell) => (
        <Marker
          key={`preview-${cell.label}`}
          position={[cell.lat, cell.lng]}
          icon={previewCellIcon()}
          interactive={false}
        />
      ))}
      {spotChecks.map((sc) => (
        <Marker
          key={sc.id}
          position={[sc.lat, sc.lng]}
          icon={spotCheckIcon(sc.rank, colorMode)}
          zIndexOffset={3000}
          eventHandlers={{
            click: (e) => {
              e.originalEvent?.stopPropagation();
              onSpotCheckClick?.(sc.id);
            },
          }}
        >
          <Popup>
            {sc.keyword}: {sc.rank != null ? `#${sc.rank}` : "20+"}
            <br />
            <span className="text-xs">{new Date(sc.checkedAt).toLocaleString()}</span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
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
}: ScanMapProps) {
  const [ready, setReady] = useState(false);
  const mapKey = useId();

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle dark:border-zinc-800 dark:bg-zinc-900"
      >
        <span className="text-sm text-text-muted">Loading map…</span>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl border border-border dark:border-zinc-800">
      <LeafletMap
        mapKey={`${mapKey}-${colorMode}-${interactionMode}`}
        officeCenter={officeCenter}
        cells={cells}
        businessName={businessName}
        colorMode={colorMode}
        onCellClick={onCellClick}
        showDeltaOverlay={showDeltaOverlay}
        interactionMode={interactionMode}
        previewCenter={previewCenter}
        previewCells={previewCells}
        onPreviewCenterChange={onPreviewCenterChange}
        onMapClick={onMapClick}
        cellsFaded={cellsFaded}
        spotChecks={spotChecks}
        onSpotCheckClick={onSpotCheckClick}
        showRadiusRings={showRadiusRings}
        radiusCenter={radiusCenter}
        radiusRingMiles={radiusRingMiles}
        gridSize={gridSize}
        radiusMeters={radiusMeters}
        syncEnabled={syncEnabled}
        syncView={syncView}
        onSyncViewChange={onSyncViewChange}
        syncZoom={syncZoom}
        resetViewKey={resetViewKey}
      />
    </div>
  );
}
