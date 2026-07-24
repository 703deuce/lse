"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  MapPin,
  Search,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";

export type MapsBridgeScreenProps = {
  businessId: string;
  businessName: string;
  overview: ReviewOverviewData;
  hasMapsScan?: boolean;
};

const SAMPLE_CELLS = [
  3, 5, 8, 12, 9, 6, 4, 2, 4, 7, 11, 8, 5, 3, 4, 6, 9, 14, 10, 7, 5, 5, 7, 10, 15,
  12, 8, 6, 3, 5, 8, 11, 9, 6, 4,
];

function cellTone(rank: number): string {
  if (rank <= 3) return "#12B76A";
  if (rank <= 10) return "#F79009";
  return "#F04438";
}

export function MapsBridgeScreen({
  businessId,
  businessName,
  overview,
  hasMapsScan = false,
}: MapsBridgeScreenProps) {
  const setupHref = `/businesses/${businessId}/maps/setup`;
  const mapsHref = `/businesses/${businessId}/maps`;
  const alreadyHasMaps = overview.hasMapsData || hasMapsScan;

  const youRating =
    overview.googleRating != null ? overview.googleRating.toFixed(1) : "—";
  const youReviews = overview.totalReviews.toLocaleString();
  const youResponse = `${Math.round(overview.responseRatePct)}%`;
  const competitorRating =
    overview.competitorAvgRatingNearby != null
      ? overview.competitorAvgRatingNearby.toFixed(1)
      : "4.7";
  const competitorReviews = (
    overview.competitorAvgReviews ?? 312
  ).toLocaleString();

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(19,119,82,0.10), transparent), linear-gradient(180deg, #f0faf4 0%, #F9FAFB 42%, #ffffff 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(19,119,82,0.12) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#137752]">
            Next step · Local Visibility
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#101828] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Your reputation is working.
            <br />
            Now own the map.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[#667085]">
            {businessName} is collecting and responding to reviews
            {overview.totalReviews > 0
              ? ` (${overview.totalReviews.toLocaleString()} on Google)`
              : ""}
            . The next win is showing up when neighbors search nearby — before
            your competitors do.
          </p>
        </div>

        {/* Formula strip */}
        <div className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-3 sm:gap-5">
          {[
            { icon: Star, label: "Reviews", sub: "Trust signal", bg: "#ECFDF3", fg: "#137752" },
            { icon: MapPin, label: "Maps rank", sub: "Local pack", bg: "#EFF8FF", fg: "#175CD3" },
            { icon: TrendingUp, label: "Growth", sub: "More calls", bg: "#FEF6EE", fg: "#C4320A" },
          ].map((item, i) => (
            <div key={item.label} className="flex items-center gap-3 sm:gap-5">
              {i > 0 ? (
                <span className="text-2xl font-light text-[#D0D5DD]">
                  {i === 1 ? "+" : "="}
                </span>
              ) : null}
              <div className="flex min-w-[5.5rem] flex-col items-center rounded-2xl border border-[#E6EAF0] bg-white px-3 py-4 shadow-sm sm:min-w-[7rem] sm:px-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: item.bg, color: item.fg }}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="mt-2 text-sm font-bold text-[#101828]">{item.label}</p>
                <p className="text-[11px] text-[#667085]">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Side-by-side: what we know + sample heatmap */}
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white shadow-sm">
            <div className="border-b border-[#E6EAF0] bg-[#F9FAFB] px-5 py-3">
              <p className="text-sm font-bold text-[#101828]">What we already know</p>
              <p className="text-xs text-[#667085]">
                From your reputation setup — ready to fuel Maps
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#E6EAF0]">
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#137752]">
                  You
                </p>
                <p className="mt-3 text-3xl font-bold tabular-nums text-[#101828]">
                  {youRating}
                  <span className="ml-1 text-base font-semibold text-[#F79009]">★</span>
                </p>
                <p className="mt-1 text-sm text-[#667085]">{youReviews} reviews</p>
                <p className="mt-3 text-sm text-[#101828]">
                  Response rate{" "}
                  <span className="font-bold text-[#137752]">{youResponse}</span>
                </p>
              </div>
              <div className="bg-[#FAFAFA] p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">
                  Typical competitor
                </p>
                <p className="mt-3 text-3xl font-bold tabular-nums text-[#101828]">
                  {competitorRating}
                  <span className="ml-1 text-base font-semibold text-[#F79009]">★</span>
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  {competitorReviews} reviews
                </p>
                <p className="mt-3 text-sm text-[#667085]">
                  Often rank higher nearby — until you scan.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white shadow-sm">
            <div className="border-b border-[#E6EAF0] bg-[#F9FAFB] px-5 py-3">
              <p className="text-sm font-bold text-[#101828]">Sample ranking heatmap</p>
              <p className="text-[11px] text-[#667085]">
                Your real report will use your city &amp; keywords
              </p>
            </div>
            <div className="p-5">
              <div
                className="grid gap-1 rounded-xl p-3"
                style={{
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  background: "linear-gradient(145deg, #e8f5ee, #f3f4f6)",
                }}
              >
                {SAMPLE_CELLS.map((rank, i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-md text-[10px] font-bold text-white shadow-sm"
                    style={{ background: cellTone(rank) }}
                  >
                    {rank}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#667085]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#12B76A]" />
                  Top 3
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#F79009]" />
                  4–10
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#F04438]" />
                  11+
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* What's inside */}
        <div className="mt-10">
          <h2 className="text-center text-lg font-bold text-[#101828]">
            What&apos;s inside your Local Visibility Report
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Search,
                title: "Keyword rankings",
                body: "See where you place for the searches that drive calls — not vanity keywords.",
              },
              {
                icon: Target,
                title: "Neighborhood coverage",
                body: "A grid heatmap around your pin shows which streets you own and which you lose.",
              },
              {
                icon: BarChart3,
                title: "Competitor gaps",
                body: "Spot who outranks you nearby and where a small push can win pack positions.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#137752]">
                  <f.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-bold text-[#101828]">{f.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#667085]">{f.body}</p>
              </div>
            ))}
          </div>

          <ul className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[#475467]">
            {[
              "Google Maps Ranking Heatmap",
              "Competitor Comparison",
              "Keyword Analysis",
              "Actionable Improvement Plan",
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#137752]" strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div
          className="mt-10 overflow-hidden rounded-2xl border shadow-md"
          style={{
            borderColor: "rgba(19,119,82,0.25)",
            background:
              "linear-gradient(135deg, #137752 0%, #0f5f42 55%, #0a4a33 100%)",
          }}
        >
          <div className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left sm:px-8">
            <div>
              <p className="text-xl font-bold text-white sm:text-2xl">
                Generate My Local Visibility Report
              </p>
              <p className="mt-1 max-w-md text-sm text-white/80">
                Confirm your pin, pick keywords, and run your first neighborhood
                scan — takes a few minutes.
              </p>
            </div>
            <Link
              href={alreadyHasMaps ? mapsHref : setupHref}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#137752] shadow-lg transition hover:bg-emerald-50"
            >
              {alreadyHasMaps ? "Open Maps Overview" : "Start Local SEO Wizard"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#667085]">
          <Link
            href={`/businesses/${businessId}/reviews`}
            className="font-semibold text-[#137752] underline-offset-2 hover:underline"
          >
            Back to Reputation Overview
          </Link>
          {!alreadyHasMaps ? (
            <>
              {" · "}
              <Link
                href={mapsHref}
                className="font-semibold underline-offset-2 hover:underline"
              >
                Already scanned? Open Maps
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
