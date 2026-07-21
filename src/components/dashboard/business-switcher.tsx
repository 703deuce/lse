"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type BusinessRow = {
  id: string;
  name: string;
  address_text?: string | null;
  scan_center_label?: string | null;
  is_tracked?: boolean | null;
};

function locationLine(b: BusinessRow): string | null {
  return b.address_text?.trim() || b.scan_center_label?.trim() || null;
}

/**
 * In-sidebar location switcher. Each business keeps its own scans, keywords,
 * backlinks, etc. — switching only changes which silo the URL points at.
 */
export function BusinessSwitcher({
  businessId,
  businessName,
  onNavigate,
}: {
  businessId?: string | null;
  businessName?: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [trackedCount, setTrackedCount] = useState(0);
  const [maxBusinesses, setMaxBusinesses] = useState<number | null>(null);
  const [canAdd, setCanAdd] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/businesses")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        setRows((json.businesses as BusinessRow[]) ?? []);
        setTrackedCount(Number(json.trackedCount ?? 0));
        setMaxBusinesses(
          typeof json.maxBusinesses === "number" ? json.maxBusinesses : null
        );
        setCanAdd(Boolean(json.canAdd));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function switchTo(nextId: string) {
    setOpen(false);
    onNavigate?.();
    if (businessId && nextId === businessId) return;
    // Keep the user on the same module path under the other location silo.
    if (pathname.startsWith("/businesses/")) {
      const nextPath = pathname.replace(
        /^\/businesses\/[^/]+/,
        `/businesses/${nextId}`
      );
      router.push(
        nextPath.startsWith(`/businesses/${nextId}`)
          ? nextPath
          : `/businesses/${nextId}/overview`
      );
      return;
    }
    // Stay in CRM when switching from a client/prospect detail page.
    if (pathname.startsWith("/clients/")) {
      router.push(`/clients/${nextId}`);
      return;
    }
    if (pathname.startsWith("/prospects/")) {
      router.push(`/prospects/${nextId}`);
      return;
    }
    // From org pages / tool pickers — open the location Dashboard.
    router.push(`/businesses/${nextId}/overview`);
  }

  const selected = businessId ? rows.find((b) => b.id === businessId) : null;
  const label =
    businessName ??
    selected?.name ??
    "Select client or prospect…";
  const place = selected ? locationLine(selected) : null;
  const tracked = rows.filter((b) => b.is_tracked !== false);
  const archived = rows.filter((b) => b.is_tracked === false);
  const accountType =
    selected?.is_tracked === false ? "Prospect" : businessId ? "Client" : null;

  return (
    <div ref={rootRef} className="relative mx-1 mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 rounded-[10px] border border-white/12 bg-white/8 px-3 py-2.5 text-left transition hover:bg-white/12"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-emerald-500/15 text-emerald-300">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-slate-100">{label}</span>
          {place || accountType ? (
            <span className="mt-0.5 block truncate text-[11px] text-slate-400">
              {[place, accountType].filter(Boolean).join(" · ")}
            </span>
          ) : (
            <span className="mt-0.5 block text-[11px] text-slate-500">Switch location context</span>
          )}
        </span>
        <ChevronDown className={cn("mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {maxBusinesses != null ? (
            <p className="border-b border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">
              Locations {trackedCount} / {maxBusinesses}
            </p>
          ) : null}

          {tracked.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={b.id === businessId}
              onClick={() => switchTo(b.id)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50",
                b.id === businessId ? "bg-emerald-50 text-emerald-900" : "text-zinc-800"
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.name}</span>
                {locationLine(b) ? (
                  <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                    {locationLine(b)}
                  </span>
                ) : null}
              </span>
              {b.id === businessId ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
            </button>
          ))}

          {archived.length > 0 ? (
            <>
              <p className="border-t border-zinc-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Archived
              </p>
              {archived.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={b.id === businessId}
                  onClick={() => switchTo(b.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="mt-0.5 block text-[11px] text-zinc-400">History kept</span>
                  </span>
                </button>
              ))}
            </>
          ) : null}

          <div className="border-t border-zinc-100 p-1">
            {canAdd ? (
              <Link
                href="/businesses/new"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add location
              </Link>
            ) : (
              <p className="px-2 py-1.5 text-[11px] text-zinc-500">
                Location limit reached. Upgrade your plan to add more.
              </p>
            )}
            <Link
              href="/clients"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="mt-0.5 flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Manage clients
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
