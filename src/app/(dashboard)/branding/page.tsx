"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  btnPrimary,
  cardClass,
  emptyStateClass,
  inputClass,
} from "@/components/ui/design-system";
import { trackProductEvent } from "@/lib/analytics/product-events";
import { cn } from "@/lib/utils";

type Branding = {
  companyName: string;
  logoUrl: string | null;
  accentColor: string | null;
  footerText: string | null;
  contactLine: string | null;
  hidePlatformBranding: boolean;
};

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/branding");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load branding");
      setBranding(json.branding);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!branding) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/workspace/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: branding.logoUrl,
          accentColor: branding.accentColor,
          footerText: branding.footerText,
          contactLine: branding.contactLine,
          hidePlatformBranding: branding.hidePlatformBranding,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setBranding(json.branding);
      setSaved(true);
      trackProductEvent("branding_completed", {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Branding"
        subtitle="Logo, colors, and contact details for white-label client and prospect reports."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : !branding ? (
        <div className={emptyStateClass}>
          <h2 className="text-base font-semibold text-zinc-900">No branding yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Add your logo and contact information so shared reports look like your own.
          </p>
        </div>
      ) : (
        <div className={cn(cardClass, "max-w-xl space-y-4 p-5")}>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {saved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Branding saved. New published reports will use these settings.
            </div>
          ) : null}

          <p className="text-sm text-zinc-600">
            Business name on reports:{" "}
            <span className="font-semibold text-zinc-900">{branding.companyName || "—"}</span>
          </p>

          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Logo URL</span>
            <input
              className={cn(inputClass, "mt-1")}
              value={branding.logoUrl ?? ""}
              onChange={(e) =>
                setBranding({ ...branding, logoUrl: e.target.value || null })
              }
              placeholder="https://…"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Primary brand color</span>
            <input
              className={cn(inputClass, "mt-1")}
              value={branding.accentColor ?? ""}
              onChange={(e) =>
                setBranding({ ...branding, accentColor: e.target.value || null })
              }
              placeholder="#137752"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Contact line</span>
            <input
              className={cn(inputClass, "mt-1")}
              value={branding.contactLine ?? ""}
              onChange={(e) =>
                setBranding({ ...branding, contactLine: e.target.value || null })
              }
              placeholder="you@agency.com · (555) 555-5555"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-zinc-700">Report footer</span>
            <textarea
              className={cn(inputClass, "mt-1 min-h-[80px]")}
              value={branding.footerText ?? ""}
              onChange={(e) =>
                setBranding({ ...branding, footerText: e.target.value || null })
              }
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={branding.hidePlatformBranding}
              onChange={(e) =>
                setBranding({ ...branding, hidePlatformBranding: e.target.checked })
              }
            />
            Hide platform branding on shared reports
          </label>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className={btnPrimary}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save branding
          </button>
        </div>
      )}
    </>
  );
}
