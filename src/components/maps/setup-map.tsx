"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps/load-google-maps";
import { useGoogleMapsApiKey } from "@/components/maps/google-maps-key-context";
import { officePinIcon } from "@/components/maps/map-pin-icons";

interface SetupMapProps {
  center: [number, number];
  onCenterChange?: (lat: number, lng: number) => void;
  height?: string;
}

export function SetupMap({ center, onCenterChange, height = "320px" }: SetupMapProps) {
  const apiKey = useGoogleMapsApiKey();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [pos, setPos] = useState(center);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    setPos(center);
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      marker.setPosition({ lat: center[0], lng: center[1] });
      map.panTo({ lat: center[0], lng: center[1] });
    }
  }, [center[0], center[1]]);

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

        clickListenerRef.current?.remove();
        markerRef.current?.setMap(null);

        const map = new g.maps.Map(containerRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        mapRef.current = map;

        const marker = new g.maps.Marker({
          map,
          position: { lat: center[0], lng: center[1] },
          icon: officePinIcon(g),
          draggable: !!onCenterChangeRef.current,
        });
        markerRef.current = marker;

        if (onCenterChangeRef.current) {
          marker.addListener("dragend", () => {
            const ll = marker.getPosition();
            if (!ll) return;
            setPos([ll.lat(), ll.lng()]);
            onCenterChangeRef.current?.(ll.lat(), ll.lng());
          });

          clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            marker.setPosition(e.latLng);
            setPos([e.latLng.lat(), e.latLng.lng()]);
            onCenterChangeRef.current?.(e.latLng.lat(), e.latLng.lng());
          });
        }

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
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <div style={{ height }} className="relative w-full overflow-hidden rounded-xl border border-border dark:border-zinc-800">
      <p className="bg-surface-subtle px-3.5 py-2 text-xs text-text-muted dark:bg-zinc-900">
        Click the map to set scan center ({pos[0].toFixed(4)}, {pos[1].toFixed(4)})
      </p>
      <div ref={containerRef} style={{ height: "calc(100% - 32px)", width: "100%" }} />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 top-8 flex items-center justify-center bg-surface-subtle/80 dark:bg-zinc-900/80">
          <span className="text-sm text-text-muted">
            {status === "error" ? error ?? "Map unavailable" : "Loading map…"}
          </span>
        </div>
      )}
    </div>
  );
}
