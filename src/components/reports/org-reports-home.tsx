"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  FileText,
  Loader2,
  Radar,
  Swords,
  Target,
} from "lucide-react";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import {
  ContentCard,
  MetricStrip,
  PageHeader,
  PageToolbar,
  btnGhost,
  btnPrimary,
  btnSecondary,
  sectionTitleClass,
} from "@/components/ui/design-system";
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
  subtitle,
  rows,
  empty,
  icon: Icon,
  iconWrap,
}: {
  title: string;
  subtitle: string;
  rows: ReportRow[];
  empty: string;
  icon: LucideIcon;
  iconWrap: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, 5);
  return (
    <ContentCard padding={false} className="overflow-hidden">
      <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            iconWrap
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className={sectionTitleClass}>{title}</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>
        </div>
        <span className="ml-auto rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600">
          {rows.length}
        </span>
      </div>
      {!rows.length ? (
        <p className="px-3.5 py-3.5 text-[12px] leading-snug text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {visibleRows.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                className="group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-zinc-50/80"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-900 group-hover:text-emerald-700">
                    {r.title}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {r.businessName}
                    {r.viewedAt ? " · viewed" : ""}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 group-hover:text-emerald-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 5 && (
        <div className="border-t border-zinc-100 px-3.5 py-2 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[12px] font-medium text-emerald-700 hover:text-emerald-800"
          >
            {expanded ? "Show less" : `Show ${rows.length - 5} more`}
          </button>
        </div>
      )}
    </ContentCard>
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

  const defaultReportBusiness = firstClient ?? firstProspect ?? businesses[0]!;

  const quickCreates = [
    {
      href: firstProspect
        ? `/businesses/${firstProspect.id}/reports?type=single_scan`
        : "/businesses/new?as=prospect",
      label: "Prospect Audit",
      icon: Target,
    },
    {
      href: firstClient
        ? `/businesses/${firstClient.id}/reports?type=monthly`
        : "/businesses/new?as=client",
      label: "Monthly Report",
      icon: FileText,
    },
    {
      href: firstClient ? `/businesses/${firstClient.id}/campaigns` : "/clients",
      label: "Campaign Progress",
      icon: Radar,
    },
    {
      href: firstClient
        ? `/businesses/${firstClient.id}/reports?type=competitor`
        : "/reports",
      label: "Competitor Report",
      icon: Swords,
    },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Drafts, published links, and monthly deliverables — the completion point of your client work."
        primaryAction={
          <Link href={`/businesses/${defaultReportBusiness.id}/reports`} className={btnPrimary}>
            <FileText className="h-4 w-4" />
            Create report
          </Link>
        }
      />

      <PageToolbar>
        {quickCreates.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href} className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
              <Icon className="h-3.5 w-3.5" />
              {a.label}
            </Link>
          );
        })}
      </PageToolbar>

      {!loading ? (
        <MetricStrip
          items={[
            { label: "Drafts", value: String(drafts.length) },
            { label: "Ready to review", value: String(ready.length) },
            { label: "Published", value: String(published.length) },
            { label: "Viewed", value: String(recent.length) },
          ]}
        />
      ) : null}

      {loading ? (
        <ContentCard className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Loading reports…
        </ContentCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <ReportGroup
            title="Drafts"
            subtitle="Still editing before publish"
            rows={drafts}
            empty="No drafts — create a monthly report to start."
            icon={FileEdit}
            iconWrap="bg-zinc-100 text-zinc-600"
          />
          <ReportGroup
            title="Ready to review"
            subtitle="Drafts waiting on your pass"
            rows={ready}
            empty="No reports waiting for review."
            icon={Clock}
            iconWrap="bg-amber-50 text-amber-600"
          />
          <ReportGroup
            title="Published"
            subtitle="Live share links for clients"
            rows={published}
            empty="No published reports yet."
            icon={CheckCircle2}
            iconWrap="bg-emerald-50 text-emerald-600"
          />
          <ReportGroup
            title="Recently viewed"
            subtitle="Client opened the share link"
            rows={recent}
            empty="Share a report link to track client views."
            icon={Eye}
            iconWrap="bg-sky-50 text-sky-600"
          />
          <ReportGroup
            title="Archived"
            subtitle="Older deliverables"
            rows={archived}
            empty="No archived reports."
            icon={Archive}
            iconWrap="bg-zinc-100 text-zinc-500"
          />
        </div>
      )}

      <ContentCard padding={false} className="overflow-hidden">
        <div className="flex items-start gap-2.5 border-b border-zinc-100 px-3.5 py-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className={sectionTitleClass}>Pick a location</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Open the full report builder for a specific prospect or client.
            </p>
          </div>
        </div>
        <ul className="divide-y divide-zinc-100">
          {businesses.map((b) => {
            const isProspect =
              b.account_type === "prospect" || b.is_tracked === false;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      isProspect
                        ? "bg-sky-50 text-sky-600 ring-sky-100"
                        : "bg-emerald-50 text-emerald-600 ring-emerald-100"
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">
                      {b.name}
                    </p>
                    <p className="text-[11px] capitalize text-zinc-500">
                      {isProspect ? "Prospect" : "Client"}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/businesses/${b.id}/reports`}
                  className={cn(btnGhost, "h-8 shrink-0 px-3 text-[12px]")}
                >
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      </ContentCard>
    </div>
  );
}
