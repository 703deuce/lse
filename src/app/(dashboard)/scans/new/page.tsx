"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, emptyStateClass, listClass } from "@/components/ui/design-system";

type Row = {
  id: string;
  name: string;
  account_type?: string | null;
  is_tracked?: boolean | null;
  archived_at?: string | null;
};

export default function NewScanPickerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/businesses")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load");
        setRows(j.businesses ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const active = rows.filter((b) => !b.archived_at);

  return (
    <>
      <PageHeader
        title="New scan"
        subtitle="Pick a prospect or client location, then configure the Maps grid."
      />
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading locations…
        </div>
      ) : active.length === 0 ? (
        <div className={emptyStateClass}>
          <p className="text-sm text-zinc-600">
            Add a prospect or client first, then run a scan.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/businesses/new?as=prospect" className="text-sm font-medium text-[#137752]">
              New prospect
            </Link>
            <Link href="/businesses/new?as=client" className="text-sm font-medium text-[#137752]">
              New client
            </Link>
          </div>
        </div>
      ) : (
        <ul className={listClass}>
          {active.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{b.name}</p>
                <p className="text-xs capitalize text-zinc-500">
                  {b.account_type === "prospect" || b.is_tracked === false
                    ? "Prospect"
                    : "Client"}
                </p>
              </div>
              <Link href={`/businesses/${b.id}/scans`} className={btnPrimary}>
                Configure scan
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
