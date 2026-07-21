"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  Clock,
  Copy,
  FileText,
  ImageIcon,
  Loader2,
  MapPinned,
  Palette,
  Sparkles,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { ModuleEmptyState } from "@/components/journey/module-empty-state";
import { mock } from "@/components/mockup/ui";
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
  address?: string | null;
};

function ReportBucketCard({
  title,
  subtitle,
  rows,
  empty,
  icon: Icon,
  iconClassName,
  footerHref,
  footerLabel,
}: {
  title: string;
  subtitle: string;
  rows: ReportRow[];
  empty: string;
  icon: LucideIcon;
  iconClassName: string;
  footerHref?: string;
  footerLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, 3);

  return (
    <div className={cn(mock.card, "flex h-full flex-col overflow-hidden")}>
      <div className="flex items-start gap-3 border-b border-[#F2F4F7] px-4 py-3.5">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconClassName
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#101828]">{title}</h2>
            <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#475467]">
              {rows.length}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#667085]">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {!rows.length ? (
          <p className="px-4 py-4 text-[13px] leading-snug text-[#667085]">{empty}</p>
        ) : (
          <ul className="divide-y divide-[#F2F4F7]">
            {visibleRows.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#F9FAFB]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#101828] group-hover:text-[#137752]">
                      {r.title}
                    </p>
                    <p className="truncate text-[11px] text-[#667085]">
                      {r.businessName}
                      {r.viewedAt ? " · viewed" : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#D0D5DD] group-hover:text-[#137752]" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {rows.length > 3 ? (
          <div className="border-t border-[#F2F4F7] px-4 py-2 text-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[12px] font-semibold text-[#137752] hover:underline"
            >
              {expanded ? "Show less" : `Show ${rows.length - 3} more`}
            </button>
          </div>
        ) : null}

        {footerHref && footerLabel ? (
          <div className="mt-auto border-t border-[#F2F4F7] px-4 py-2.5">
            <Link
              href={footerHref}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#137752] hover:underline"
            >
              {footerLabel}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : null}
      </div>
    </div>
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

  const featureCards = [
    {
      href: firstProspect
        ? `/businesses/${firstProspect.id}/reports?type=single_scan`
        : "/businesses/new?as=prospect",
      label: "Keyword Audit",
      hint: "Not Started",
      icon: Target,
      wrap: "bg-[#EFF8FF] text-[#175CD3]",
    },
    {
      href: firstClient
        ? `/businesses/${firstClient.id}/reports?type=trend`
        : "/businesses/new?as=client",
      label: "Monthly Report",
      hint: "New reports every 30 days",
      icon: FileText,
      wrap: "bg-[#ECFDF3] text-[#027A48]",
    },
    {
      href: "/clients",
      label: "Group Reports",
      hint: "View all group reports",
      icon: Users,
      wrap: "bg-[#F4F3FF] text-[#5925DC]",
    },
    {
      href: firstClient
        ? `/businesses/${firstClient.id}/reports?type=competitor`
        : "/reports",
      label: "Competitive Report",
      hint: published.length ? "Newly created" : "Ready when you are",
      icon: Swords,
      wrap: "bg-[#FFFAEB] text-[#B54708]",
    },
  ] as const;

  const metricCards = [
    { label: "Audit", value: drafts.length + ready.length },
    { label: "Monthly reports", value: published.length },
    { label: "Grouped", value: recent.length },
    { label: "Deleted", value: archived.length },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className={cn(
                mock.card,
                "flex items-center gap-3 p-4 transition hover:border-[#A6F4C5] hover:bg-[#ECFDF3]/40"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  card.wrap
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-[#101828]">
                  {card.label}
                </span>
                <span className="mt-0.5 block text-[12px] text-[#667085]">{card.hint}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {!loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((kpi) => (
            <div key={kpi.label} className={cn(mock.card, "px-4 py-3.5")}>
              <p className={mock.label}>{kpi.label}</p>
              <p className="mt-1.5 text-[26px] font-bold tabular-nums leading-none tracking-tight text-[#101828]">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className={cn(mock.cardPad, "flex items-center gap-2 text-sm text-[#667085]")}>
          <Loader2 className="h-4 w-4 animate-spin text-[#137752]" />
          Loading reports…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <ReportBucketCard
            title="Events"
            subtitle={
              recent.length
                ? `${recent.length} report view${recent.length === 1 ? "" : "s"} recently`
                : "No events within last 30 days"
            }
            rows={recent}
            empty="No events within last 30 days"
            icon={Sparkles}
            iconClassName="bg-[#F4F3FF] text-[#5925DC]"
            footerHref={firstClient ? `/businesses/${firstClient.id}/reports` : "/clients"}
            footerLabel="View events → Explore events from all reports"
          />
          <ReportBucketCard
            title="Media & Content"
            subtitle="Drafts and assets waiting to publish"
            rows={drafts}
            empty="No draft media yet"
            icon={ImageIcon}
            iconClassName="bg-[#FFF6ED] text-[#C4320A]"
            footerHref="/settings"
            footerLabel="Explore media → View report media in bulk"
          />
          <ReportBucketCard
            title="Duplicates"
            subtitle={
              archived.length
                ? `${archived.length} archived deliverable${archived.length === 1 ? "" : "s"}`
                : "No duplicates within last 30 days"
            }
            rows={archived}
            empty="No duplicates within last 30 days"
            icon={Copy}
            iconClassName="bg-[#ECFDF3] text-[#027A48]"
            footerHref="/clients"
            footerLabel="View duplicates → View duplicate listings in bulk"
          />
          <ReportBucketCard
            title="Proximity reports"
            subtitle="Maps grid and location deliverables"
            rows={published}
            empty="No published proximity reports yet"
            icon={MapPinned}
            iconClassName="bg-[#F4F3FF] text-[#5925DC]"
            footerHref={firstClient ? `/businesses/${firstClient.id}/scans` : "/clients"}
            footerLabel="View proximity reports → View your proximity reports"
          />
          <ReportBucketCard
            title="Ready to review"
            subtitle="Drafts waiting on your pass"
            rows={ready}
            empty="No reports waiting for review"
            icon={Clock}
            iconClassName="bg-[#FFFAEB] text-[#B54708]"
            footerHref={firstClient ? `/businesses/${firstClient.id}/reports` : "/clients"}
            footerLabel="Review drafts → Open the report builder"
          />
          <div className={cn(mock.card, "flex h-full flex-col overflow-hidden")}>
            <div className="flex items-start gap-3 border-b border-[#F2F4F7] px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF8FF] text-[#175CD3]">
                <Palette className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-[#101828]">White label</h2>
                <p className="mt-0.5 text-[12px] text-[#667085]">Your white label data</p>
              </div>
            </div>
            <p className="px-4 py-4 text-[13px] leading-snug text-[#667085]">
              Brand logos, colors, and share-link chrome for client-facing reports.
            </p>
            <div className="mt-auto border-t border-[#F2F4F7] px-4 py-2.5">
              <Link
                href="/settings"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#137752] hover:underline"
              >
                Your white label info
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className={cn(mock.card, "overflow-hidden")}>
        <div className="border-b border-[#F2F4F7] px-4 py-3.5">
          <h2 className="text-[16px] font-bold text-[#101828]">Main Locations</h2>
          <p className="mt-0.5 text-[13px] text-[#667085]">
            Locations in this account — open the full report builder for any prospect or client.
          </p>
        </div>
        <ul className="divide-y divide-[#F2F4F7]">
          {businesses.map((b) => {
            const isProspect =
              b.account_type === "prospect" || b.is_tracked === false;
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      isProspect
                        ? "bg-[#EFF8FF] text-[#175CD3]"
                        : "bg-[#ECFDF3] text-[#027A48]"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#101828]">
                      {b.name}
                    </p>
                    <p className="truncate text-[12px] text-[#667085]">
                      {b.address?.trim() || (isProspect ? "Prospect" : "Client location")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={mock.badgeGreen}>Active</span>
                  <Link
                    href={`/businesses/${b.id}/reports`}
                    className={cn(mock.btnPrimary, "h-9 px-3.5 text-[12px] uppercase tracking-wide")}
                  >
                    View report
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
