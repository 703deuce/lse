"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { btnPrimary, btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type ReportRow = {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  reportType: string | null;
  publishStatus: string;
  href: string;
  createdAt: string | null;
  viewedAt: string | null;
};

type BusinessOption = {
  id: string;
  name: string;
  account_type?: string | null;
  is_tracked?: boolean | null;
};

function ReportGroup({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: ReportRow[];
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>
      {!rows.length ? (
        <p className="mt-2 text-[12px] text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={r.href} className="truncate text-[13px] font-medium text-zinc-900 hover:text-emerald-700">
                  {r.title}
                </Link>
                <p className="truncate text-[11px] text-zinc-500">
                  {r.businessName}
                  {r.viewedAt ? " · viewed" : ""}
                </p>
              </div>
              <Link href={r.href} className="shrink-0 text-[11px] font-medium text-emerald-700">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OrgReportsHome({ businesses }: { businesses: BusinessOption[] }) {
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<ReportRow[]>([]);
  const [ready, setReady] = useState<ReportRow[]>([]);
  const [published, setPublished] = useState<ReportRow[]>([]);
  const [recent, setRecent] = useState<ReportRow[]>([]);
  const [archived, setArchived] = useState<ReportRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/reports/list");
        const json = await res.json();
        if (res.ok) {
          setDrafts(json.drafts ?? []);
          setReady(json.readyToReview ?? []);
          setPublished(json.published ?? []);
          setRecent(json.recentlyViewed ?? []);
          setArchived(json.archived ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const firstClient = businesses.find(
    (b) => b.account_type !== "prospect" && b.is_tracked !== false
  );
  const firstProspect = businesses.find(
    (b) => b.account_type === "prospect" || b.is_tracked === false
  );

  if (!businesses.length) {
    return (
      <ModuleEmptyState
        title="No reports yet"
        description="Combine Maps, AI, reviews and growth data into a professional client report. Add a prospect or client first."
        actionLabel="Add client"
        actionHref="/businesses/new?as=client"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          {
            href: firstProspect
              ? `/businesses/${firstProspect.id}/reports?type=single_scan`
              : "/businesses/new?as=prospect",
            label: "Create Prospect Audit",
          },
          {
            href: firstClient
              ? `/businesses/${firstClient.id}/reports?type=monthly`
              : "/businesses/new?as=client",
            label: "Create Monthly Report",
          },
          {
            href: firstClient
              ? `/businesses/${firstClient.id}/campaigns`
              : "/clients",
            label: "Campaign Progress",
          },
          {
            href: firstClient
              ? `/businesses/${firstClient.id}/reports?type=competitor`
              : "/reports",
            label: "Competitor Report",
          },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={cn(btnSecondary, "h-9 gap-1.5 px-3 text-[12px]")}
          >
            <FileText className="h-3.5 w-3.5" />
            {a.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportGroup title="Drafts" rows={drafts.slice(0, 8)} empty="No drafts — create a monthly report to start." />
          <ReportGroup
            title="Ready to review"
            rows={ready.slice(0, 8)}
            empty="No reports waiting for review."
          />
          <ReportGroup
            title="Published"
            rows={published.slice(0, 8)}
            empty="No published reports yet."
          />
          <ReportGroup
            title="Recently viewed"
            rows={recent.slice(0, 8)}
            empty="Share a report link to track client views."
          />
          <ReportGroup title="Archived" rows={archived.slice(0, 6)} empty="No archived reports." />
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-zinc-900">Pick a location</h2>
        <p className="mt-1 text-[12px] text-zinc-500">
          Open the full report builder for a specific prospect or client.
        </p>
        <ul className="mt-3 divide-y divide-zinc-100">
          {businesses.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{b.name}</p>
                <p className="text-xs capitalize text-zinc-500">
                  {b.account_type === "prospect" || b.is_tracked === false ? "Prospect" : "Client"}
                </p>
              </div>
              <Link
                href={`/businesses/${b.id}/reports`}
                className={cn(btnPrimary, "h-8 px-3 text-[12px]")}
              >
                Open reports
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
