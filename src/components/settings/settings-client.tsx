"use client";

import { useEffect, useState } from "react";
import { updateBusinessSettings } from "@/lib/actions/mutations";
import { PageHeader } from "@/components/ui/page-header";
import { SetupMap } from "@/components/maps/setup-map";
import { ScanSetupForm, defaultScanSetupValues } from "@/components/scan/scan-setup-form";
import { AccountPlanUsageCard } from "@/components/settings/account-plan-usage-card";
import { AutomationApiKeysCard } from "@/components/settings/automation-api-keys-card";

export function SettingsClient({
  businessId,
  business,
  initialWeeklyEnabled = false,
}: {
  businessId: string;
  business: {
    name: string;
    address_text: string | null;
    service_area_mode: string;
    website_url: string | null;
    scan_center_lat: number | null;
    scan_center_lng: number | null;
    lat: number | null;
    lng: number | null;
  };
  initialWeeklyEnabled?: boolean;
}) {
  const [center, setCenter] = useState<[number, number]>([
    business.scan_center_lat ?? business.lat ?? 40.7128,
    business.scan_center_lng ?? business.lng ?? -74.006,
  ]);
  const [weeklyEnabled, setWeeklyEnabled] = useState(initialWeeklyEnabled);
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [centerSaving, setCenterSaving] = useState(false);
  const [centerSaved, setCenterSaved] = useState(false);
  const [centerError, setCenterError] = useState<string | null>(null);
  const [scanDefaults, setScanDefaults] = useState(() =>
    defaultScanSetupValues(
      business.scan_center_lat ?? business.lat ?? 40.7128,
      business.scan_center_lng ?? business.lng ?? -74.006
    )
  );
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandAccent, setBrandAccent] = useState("#059669");
  const [brandFooter, setBrandFooter] = useState("");
  const [brandContact, setBrandContact] = useState("");
  const [brandHidePlatform, setBrandHidePlatform] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/schedule?businessId=${businessId}`);
        const json = await res.json();
        if (!active) return;
        if (res.ok) {
          setWeeklyEnabled(Boolean(json.enabled));
          setScanDefaults((prev) => ({
            ...prev,
            ...(typeof json.gridSize === "number" ? { gridSize: json.gridSize } : {}),
            ...(typeof json.radiusMeters === "number" ? { radiusMeters: json.radiusMeters } : {}),
          }));
        }
      } catch {
        /* ignore hydrate failures — keep initial */
      }
    })();
    return () => {
      active = false;
    };
  }, [businessId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/workspace/branding");
        const json = await res.json();
        if (!active || !res.ok) return;
        const b = json.branding ?? {};
        setBrandLogoUrl(b.logoUrl ?? "");
        setBrandAccent(b.accentColor ?? "#059669");
        setBrandFooter(b.footerText ?? "");
        setBrandContact(b.contactLine ?? "");
        setBrandHidePlatform(Boolean(b.hidePlatformBranding));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveCenter(next: [number, number] = center) {
    setCenterSaving(true);
    setCenterError(null);
    setCenterSaved(false);
    try {
      await updateBusinessSettings(businessId, {
        scan_center_lat: next[0],
        scan_center_lng: next[1],
      });
      setCenterSaved(true);
      setTimeout(() => setCenterSaved(false), 2000);
    } catch (err) {
      setCenterError(err instanceof Error ? err.message : "Failed to save scan center");
    } finally {
      setCenterSaving(false);
    }
  }

  async function toggleWeekly() {
    const next = !weeklyEnabled;
    setWeeklySaving(true);
    setWeeklyError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          enabled: next,
          gridSize: scanDefaults.gridSize,
          radiusMeters: scanDefaults.radiusMeters,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update schedule");
      setWeeklyEnabled(Boolean(json.enabled));
      if (typeof json.gridSize === "number" || typeof json.radiusMeters === "number") {
        setScanDefaults((prev) => ({
          ...prev,
          ...(typeof json.gridSize === "number" ? { gridSize: json.gridSize } : {}),
          ...(typeof json.radiusMeters === "number" ? { radiusMeters: json.radiusMeters } : {}),
        }));
      }
    } catch (err) {
      setWeeklyError(err instanceof Error ? err.message : "Failed to update schedule");
    } finally {
      setWeeklySaving(false);
    }
  }

  async function saveBranding() {
    setBrandSaving(true);
    setBrandError(null);
    setBrandSaved(false);
    try {
      const res = await fetch("/api/workspace/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: brandLogoUrl.trim() || "",
          accentColor: brandAccent.trim() || "",
          footerText: brandFooter.trim() || null,
          contactLine: brandContact.trim() || null,
          hidePlatformBranding: brandHidePlatform,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save branding");
      const b = json.branding ?? {};
      setBrandLogoUrl(b.logoUrl ?? "");
      setBrandAccent(b.accentColor ?? "#059669");
      setBrandFooter(b.footerText ?? "");
      setBrandContact(b.contactLine ?? "");
      setBrandHidePlatform(Boolean(b.hidePlatformBranding));
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setBrandSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Scan defaults and business details" />

      <div className="mb-8">
        <AccountPlanUsageCard />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="font-semibold">Business details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-zinc-500">Name</dt>
              <dd className="text-right font-medium text-zinc-900">{business.name}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-zinc-500">Address</dt>
              <dd className="text-right font-medium text-zinc-900">{business.address_text ?? "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-zinc-500">Mode</dt>
              <dd className="text-right font-medium capitalize text-zinc-900">{business.service_area_mode.replace("_", " ")}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-zinc-500">Website</dt>
              <dd className="truncate text-right font-medium text-zinc-900">{business.website_url ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="font-semibold">Scan center</h2>
          <p className="mt-1 text-sm text-zinc-500">Click map to move center for service-area audits</p>
          <div className="mt-4">
            <SetupMap
              center={center}
              onCenterChange={(lat, lng) => {
                setCenter([lat, lng]);
                setCenterSaved(false);
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveCenter()}
              disabled={centerSaving}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition hover:bg-zinc-50 disabled:opacity-60"
            >
              {centerSaving ? "Saving…" : "Save scan center"}
            </button>
            {centerSaved && <p className="text-sm text-emerald-600">Saved</p>}
            {centerError && <p className="text-sm text-red-600">{centerError}</p>}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="font-semibold">Baseline scan setup</h2>
        <ScanSetupForm
          businessId={businessId}
          defaults={{
            ...scanDefaults,
            scanCenterLat: center[0],
            scanCenterLng: center[1],
          }}
          scanCenter={center}
          onDefaultsChange={(next) => setScanDefaults((prev) => ({ ...prev, ...next }))}
        />
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="font-semibold">Weekly automation</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">Automatically re-run your baseline scan every week to track ranking changes over time.</p>
        <button
          type="button"
          onClick={() => void toggleWeekly()}
          disabled={weeklySaving}
          className="mt-4 rounded-lg border border-zinc-200 px-4 py-2 text-sm transition hover:bg-zinc-50 disabled:opacity-60"
        >
          {weeklySaving ? "Saving…" : weeklyEnabled ? "Disable" : "Enable"} weekly scan
        </button>
        {weeklyError && <p className="mt-2 text-sm text-red-600">{weeklyError}</p>}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="font-semibold">Report branding</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          White-label logo, accent color, and footer used on shareable HTML / PDF reports across this
          workspace.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-500">Logo URL</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={brandLogoUrl}
              onChange={(e) => setBrandLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">Accent color</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border border-zinc-200 bg-white p-1"
                value={/^#([0-9a-fA-F]{6})$/.test(brandAccent) ? brandAccent : "#059669"}
                onChange={(e) => setBrandAccent(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={brandAccent}
                onChange={(e) => setBrandAccent(e.target.value)}
                placeholder="#059669"
              />
            </div>
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={brandHidePlatform}
              onChange={(e) => setBrandHidePlatform(e.target.checked)}
            />
            Hide platform credit in footer
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-500">Footer text</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={brandFooter}
              onChange={(e) => setBrandFooter(e.target.value)}
              placeholder="Confidential — prepared for client review"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-500">Contact line</span>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              value={brandContact}
              onChange={(e) => setBrandContact(e.target.value)}
              placeholder="agency@example.com · (555) 555-5555"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void saveBranding()}
            disabled={brandSaving}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm transition hover:bg-zinc-50 disabled:opacity-60"
          >
            {brandSaving ? "Saving…" : "Save report branding"}
          </button>
          {brandSaved && <p className="text-sm text-emerald-600">Saved</p>}
          {brandError && <p className="text-sm text-red-600">{brandError}</p>}
        </div>
      </section>

      <AutomationApiKeysCard businessId={businessId} />

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-900">Google connected mode</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-800">
          Official GBP OAuth unlocks location sync, review replies, posts, media, and performance insights after Google Cloud approval.
        </p>
      </section>
    </>
  );
}
