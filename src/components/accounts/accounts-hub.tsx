"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Plus, UserCheck, Archive } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type BusinessRow = {
  id: string;
  name: string;
  address_text?: string | null;
  scan_center_label?: string | null;
  primary_category?: string | null;
  is_tracked?: boolean | null;
  created_at?: string | null;
};

function locationSubtitle(b: BusinessRow): string {
  return b.address_text?.trim() || b.scan_center_label?.trim() || b.primary_category || "—";
}

/**
 * Phase 1 freelancer lists.
 * Clients = tracked businesses (plan slots).
 * Prospects = untracked businesses (audits / archived until Phase 2 account_type).
 */
export function AccountsHub({
  mode,
  accessMessage,
}: {
  mode: "prospects" | "clients";
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
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.businesses ?? []);
      setTrackedCount(Number(json.trackedCount ?? 0));
      setMaxBusinesses(Number(json.maxBusinesses ?? 0));
      setPlanName(String(json.planName ?? ""));
      setCanAdd(Boolean(json.canAdd));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function convertToClient(businessId: string) {
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
              ? "Active location limit reached. Archive a client or upgrade."
              : "Could not convert to client")
        );
      }
      await load();
      router.refresh();
      router.push(`/businesses/${businessId}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert to client");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveClient(businessId: string) {
    if (
      !confirm(
        "Archive this client location? It frees a plan slot. Scans and reports stay saved — you can restore later."
      )
    ) {
      return;
    }
    setBusyId(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/untrack`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not archive");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not archive");
    } finally {
      setBusyId(null);
    }
  }

  const clients = rows.filter((b) => b.is_tracked !== false);
  const prospects = rows.filter((b) => b.is_tracked === false);
  const list = mode === "clients" ? clients : prospects;

  const title = mode === "clients" ? "Clients" : "Prospects";
  const subtitle =
    mode === "clients"
      ? "Active client locations you track with Maps scans and branded reports."
      : "Prospect audits for outreach. Convert to a client when you win the work — scans and reports stay attached.";

  const emptyTitle = mode === "clients" ? "No clients yet" : "No prospects yet";
  const emptyBody =
    mode === "clients"
      ? "Add your first client to organize their locations, keywords, scans, and reports."
      : "Create a prospect to run an audit and produce a report you can use during outreach or a sales call.";

  const newHref =
    mode === "clients" ? "/businesses/new?as=client" : "/businesses/new?as=prospect";
  const newLabel = mode === "clients" ? "New client" : "New prospect";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          mode === "clients" && !canAdd ? (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {trackedCount}/{maxBusinesses} active locations — upgrade to add more
            </span>
          ) : (
            <Link
              href={newHref}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {newLabel}
            </Link>
          )
        }
      />

      {mode === "clients" ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 font-medium text-zinc-800">
            {trackedCount} / {maxBusinesses || "—"} active locations
          </span>
          {planName ? <span>{planName} plan</span> : null}
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-600">
          Prospect audits do not use an active location slot until you convert them to a client.
        </p>
      )}

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
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
          <MapPin className="mx-auto h-8 w-8 text-zinc-300" />
          <h2 className="mt-3 text-base font-semibold text-zinc-900">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{emptyBody}</p>
          <Link
            href={newHref}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {newLabel}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {list.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/businesses/${b.id}/overview`}
                  className="truncate text-sm font-semibold text-zinc-900 hover:text-emerald-700"
                >
                  {b.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{locationSubtitle(b)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  href={`/businesses/${b.id}/scans`}
                  className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Scans
                </Link>
                <Link
                  href={`/businesses/${b.id}/reports`}
                  className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Reports
                </Link>
                {mode === "prospects" ? (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => void convertToClient(b.id)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )}
                    Convert to client
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => void archiveClient(b.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {busyId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                    Archive
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
