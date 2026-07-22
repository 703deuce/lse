"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSearch, Loader2, MapPin, Plus } from "lucide-react";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

type AuditListRow = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  prospectStatus: string | null;
  auditStatus: "not_run" | "running" | "ready" | "failed" | "shared";
  auditId: string | null;
  keywords: string[];
  updatedAt: string | null;
};

function statusLabel(status: AuditListRow["auditStatus"]): string {
  switch (status) {
    case "running":
      return "Running";
    case "ready":
      return "Ready";
    case "shared":
      return "Shared";
    case "failed":
      return "Failed";
    default:
      return "Not run";
  }
}

function statusClass(status: AuditListRow["auditStatus"]): string {
  switch (status) {
    case "running":
      return mock.badgeAmber;
    case "ready":
    case "shared":
      return mock.badgeGreen;
    case "failed":
      return mock.badgeRed;
    default:
      return "inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]";
  }
}

export function ProspectAuditsHub() {
  const [rows, setRows] = useState<AuditListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prospect-audits/list");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load audits");
      setRows(json.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={mock.title}>Prospect audits</h1>
          <p className={mock.subtitle}>
            Review scan settings and run an audit for any prospect — then share the finished report.
          </p>
        </div>
        <Link href="/businesses/new?as=prospect" className={mock.btnPrimary}>
          <Plus className="h-4 w-4" />
          New prospect
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading prospect audits…
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(mock.cardPad, "text-center")}>
          <FileSearch className="mx-auto h-8 w-8 text-[#98A2B3]" />
          <p className="mt-3 text-[15px] font-semibold text-[#101828]">No prospects yet</p>
          <p className="mt-1 text-sm text-[#667085]">
            Create a prospect with up to three keywords, then open Audit to run the report.
          </p>
          <Link href="/businesses/new?as=prospect" className={cn(mock.btnPrimary, "mt-4 inline-flex")}>
            Add prospect
          </Link>
        </div>
      ) : (
        <div className={cn(mock.card, "overflow-hidden")}>
          <ul className="divide-y divide-[#F2F4F7]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/prospects/${row.id}/audit`}
                      className="truncate text-[14px] font-semibold text-[#101828] hover:text-[#137752]"
                    >
                      {row.name}
                    </Link>
                    <span className={statusClass(row.auditStatus)}>{statusLabel(row.auditStatus)}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[#667085]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {row.address ?? row.category ?? "—"}
                  </p>
                  {row.keywords.length ? (
                    <p className="mt-1 truncate text-[12px] text-[#475467]">
                      Keywords: {row.keywords.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/prospects/${row.id}/audit`}
                  className={cn(mock.btnSecondary, "shrink-0")}
                >
                  {row.auditStatus === "not_run" || row.auditStatus === "failed"
                    ? "Open audit setup"
                    : row.auditStatus === "running"
                      ? "View progress"
                      : "Open audit"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
