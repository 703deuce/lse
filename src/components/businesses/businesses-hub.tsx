"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Archive, Loader2, MapPin, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, cardClass, emptyStateClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type BusinessRow = {
  id: string;
  name: string;
  address_text?: string | null;
  scan_center_label?: string | null;
  primary_category?: string | null;
  is_tracked?: boolean | null;
};

function locationSubtitle(b: BusinessRow): string {
  return b.address_text?.trim() || b.scan_center_label?.trim() || b.primary_category || "—";
}

export function BusinessesHub({
  accessMessage,
}: {
  accessMessage?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [trackedCount, setTrackedCount] = useState(0);
  const [maxBusinesses, setMaxBusinesses] = useState(0);
  const [planName, setPlanName] = useState("");
  const [canAdd, setCanAdd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load locations");
      setRows(json.businesses ?? []);
      setTrackedCount(Number(json.trackedCount ?? 0));
      setMaxBusinesses(Number(json.maxBusinesses ?? 0));
      setPlanName(String(json.planName ?? ""));
      setCanAdd(Boolean(json.canAdd));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function untrack(businessId: string) {
    if (
      !confirm(
        "Archive this location? It stops using a plan slot. Scans and module history stay saved — you can open it anytime or restore it later."
      )
    ) {
      return;
    }
    setBusyId(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/untrack`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not archive location");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive location");
    } finally {
      setBusyId(null);
    }
  }

  async function restore(businessId: string) {
    setBusyId(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/convert-to-tracked`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error ??
            (res.status === 402
              ? "Location limit reached for your plan. Archive another location or upgrade."
              : "Could not restore location")
        );
      }
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore location");
    } finally {
      setBusyId(null);
    }
  }

  const tracked = rows.filter((b) => b.is_tracked !== false);
  const archived = rows.filter((b) => b.is_tracked === false);

  return (
    <>
      <PageHeader
        title="Your locations"
        subtitle="Each location is its own silo — scans, keywords, backlinks, and audits stay with that business."
        actions={
          canAdd ? (
            <Link href="/businesses/new" className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Add location
            </Link>
          ) : (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {trackedCount}/{maxBusinesses} locations used — upgrade to add more
            </span>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium text-zinc-800">
          {trackedCount} / {maxBusinesses || "—"} locations
        </span>
        {planName ? <span>{planName} plan</span> : null}
      </div>

      {accessMessage ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {accessMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : !rows.length ? (
        <div className={cn(emptyStateClass, "p-12")}>
          <MapPin className="mx-auto h-10 w-10 text-zinc-400" />
          <h2 className="mt-4 text-lg font-medium">No locations yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Add your first business location to run scans and module audits. Everything you run
            stays with that location.
          </p>
          <Link href="/businesses/new" className={cn(btnPrimary, "mt-6")}>
            Get started
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Active locations</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tracked.map((b) => (
                <article
                  key={b.id}
                  className={cn(cardClass, "flex flex-col p-5")}
                >
                  <Link href={`/businesses/${b.id}/overview`} className="min-w-0 flex-1">
                    <h3 className="font-semibold text-zinc-900 hover:text-[#137752]">{b.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {locationSubtitle(b)}
                    </p>
                    {b.primary_category ? (
                      <span className="mt-3 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {b.primary_category}
                      </span>
                    ) : null}
                  </Link>
                  <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3">
                    <Link
                      href={`/businesses/${b.id}/overview`}
                      className="text-sm font-medium text-[#137752] hover:underline"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void untrack(b.id)}
                      className="ml-auto inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                    >
                      {busyId === b.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      Archive
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!tracked.length ? (
              <p className="text-sm text-zinc-500">No active locations. Restore one below or add new.</p>
            ) : null}
          </section>

          {archived.length > 0 ? (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-zinc-900">Archived locations</h2>
              <p className="mb-3 text-xs text-zinc-500">
                History is kept (scans, backlinks, audits). Restoring uses a plan slot again.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archived.map((b) => (
                  <article
                    key={b.id}
                    className="flex flex-col rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4"
                  >
                    <Link href={`/businesses/${b.id}/overview`} className="min-w-0">
                      <h3 className="font-medium text-zinc-800 hover:text-emerald-700">{b.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{locationSubtitle(b)}</p>
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === b.id || !canAdd}
                      onClick={() => void restore(b.id)}
                      className="mt-3 inline-flex items-center gap-1 self-start text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"
                      title={!canAdd ? "At location limit for your plan" : "Restore to active"}
                    >
                      {busyId === b.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restore
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
