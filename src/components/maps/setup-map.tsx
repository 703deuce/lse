"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });

const MapClickLayer = dynamic(() => import("./map-click-layer").then((m) => m.MapClickLayer), {
  ssr: false,
});

interface SetupMapProps {
  center: [number, number];
  onCenterChange?: (lat: number, lng: number) => void;
  height?: string;
}

export function SetupMap({ center, onCenterChange, height = "320px" }: SetupMapProps) {
  const [pos, setPos] = useState(center);

  useEffect(() => {
    setPos(center);
  }, [center[0], center[1]]);

  function handleMove(lat: number, lng: number) {
    setPos([lat, lng]);
    onCenterChange?.(lat, lng);
  }

  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-xl border border-border dark:border-zinc-800">
      <p className="bg-surface-subtle px-3 py-2 text-xs text-text-muted dark:bg-zinc-900">
        Click the map to set scan center ({pos[0].toFixed(4)}, {pos[1].toFixed(4)})
      </p>
      <MapContainer center={pos} zoom={13} style={{ height: "calc(100% - 32px)", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={pos} />
        {onCenterChange && <MapClickLayer onMove={handleMove} />}
      </MapContainer>
    </div>
  );
}
