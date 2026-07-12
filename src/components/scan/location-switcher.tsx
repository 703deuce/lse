"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type { LocationScanSummary } from "@/lib/maps/scan-queries";

interface LocationSwitcherProps {
  businessId: string;
  keywordId: string | null;
  gridSize: number;
  radiusMeters: number;
  selectedLocationId: string | null;
  onLocationChange: (location: LocationScanSummary, scanId: string | null) => void;
  onPickCoords?: (lat: number, lng: number) => void;
  className?: string;
  compact?: boolean;
}

export function LocationSwitcher({
  businessId,
  keywordId,
  gridSize,
  radiusMeters,
  selectedLocationId,
  onLocationChange,
  className,
  compact = false,
}: LocationSwitcherProps) {
  const [locations, setLocations] = useState<LocationScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    lat: "",
    lng: "",
    defaultGridSize: gridSize,
    defaultRadiusMiles: Math.round((radiusMeters / 1609.344) * 10) / 10,
  });

  const loadLocations = useCallback(async () => {
    if (!keywordId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        keywordId,
        gridSize: String(gridSize),
        radius: String(radiusMeters),
      });
      const res = await fetch(`/api/locations/${businessId}?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load locations");
      setLocations(json.locations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId, keywordId, gridSize, radiusMeters]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const selected =
    locations.find((l) => l.id === selectedLocationId) ??
    locations.find((l) => l.isBusinessLocation) ??
    locations[0];

  function handleSelect(loc: LocationScanSummary) {
    onLocationChange(loc, loc.latestScanId);
  }

  async function saveLocation() {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!form.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Name and valid coordinates required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/locations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          lat,
          lng,
          defaultGridSize: form.defaultGridSize,
          defaultRadiusMiles: form.defaultRadiusMiles,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setShowAdd(false);
      await loadLocations();
      if (json.location) {
        onLocationChange(
          {
            id: json.location.id,
            name: json.location.name,
            address: json.location.address,
            city: json.location.city,
            state: json.location.state,
            lat: json.location.lat,
            lng: json.location.lng,
            defaultGridSize: json.location.default_grid_size,
            defaultRadiusMiles: Number(json.location.default_radius_miles),
            latestScanId: null,
            latestRank: null,
            solv: null,
            lastScannedAt: null,
            isBusinessLocation: false,
          },
          null
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <label
        className={
          compact
            ? "text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
            : "text-xs font-semibold uppercase tracking-wide text-text-muted"
        }
      >
        Location
      </label>
      {loading ? (
        <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="mt-1 flex gap-2">
          <select
            value={selected?.id ?? "business"}
            onChange={(e) => {
              const id = e.target.value === "business" ? null : e.target.value;
              const loc = locations.find((l) => (l.id ?? "business") === (id ?? "business"));
              if (loc) handleSelect(loc);
            }}
            className={
              compact
                ? "min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                : "min-w-[200px] flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            }
          >
            {locations.map((loc) => (
              <option key={loc.id ?? "business"} value={loc.id ?? "business"}>
                {compact
                  ? `${loc.name}${loc.city || loc.state ? ` · ${[loc.city, loc.state].filter(Boolean).join(", ")}` : ""}`
                  : `${loc.name}${loc.city || loc.state ? ` · ${[loc.city, loc.state].filter(Boolean).join(", ")}` : ""}${loc.latestRank != null ? ` · #${rankLabel(Math.round(loc.latestRank))}` : ""}${loc.solv != null ? ` · SoLV ${loc.solv}%` : ""}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-white text-text-muted shadow-sm hover:bg-surface-subtle"
            title="Add location"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {selected && !selected.latestScanId && keywordId && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          No scan for this location yet. Run a grid scan?
        </p>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
            <h3 className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4" /> Add location
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Save a neighborhood or area. Enter coordinates from a map click.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Location name (e.g. Dale City)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="text"
                placeholder="Address (optional)"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className="rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={form.lat}
                  onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                  className="rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={form.lng}
                  onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                  className="rounded-lg border border-border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLocation()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
