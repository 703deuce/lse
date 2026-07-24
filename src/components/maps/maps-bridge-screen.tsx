"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  btnPrimary,
  btnSecondary,
  cardClass,
  cardPadding,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";

function fmtRating(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

export type MapsBridgeScreenProps = {
  businessId: string;
  businessName: string;
  overview: ReviewOverviewData;
  hasMapsScan?: boolean;
};

export function MapsBridgeScreen({
  businessId,
  businessName,
  overview,
  hasMapsScan = false,
}: MapsBridgeScreenProps) {
  const setupHref = `/businesses/${businessId}/maps/setup`;
  const reputationHref = `/businesses/${businessId}/reputation/overview`;
  const mapsHref = `/businesses/${businessId}/maps`;

  const competitorNames = overview.impactRows
    .filter((r) => !r.isYou && r.name !== "Benchmark Avg")
    .map((r) => r.name)
    .slice(0, 3);

  const alreadyHasMaps = overview.hasMapsData || hasMapsScan;

  return (
    <ModulePage>
      <ModuleHeader
        icon={MapPin}
        title="Check Local Visibility"
        subtitle="Reviews are only one part of Google Maps visibility."
        actions={
          <Link href={reputationHref} className={btnSecondary}>
            <ArrowLeft className="h-4 w-4" />
            Back to Reputation
          </Link>
        }
      />

      <section className={cn(cardClass, cardPadding)}>
        <h2 className="text-[14px] font-semibold text-zinc-900">What we know</h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          From your review performance for {businessName}.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Your rating / reviews
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-zinc-900">
                {fmtRating(overview.googleRating)}
              </span>
              <Star className="h-4 w-4 fill-[#FDB022] text-[#FDB022]" />
            </div>
            <p className="mt-1 text-[13px] text-zinc-600">
              {fmtCount(overview.totalReviews)} reviews
              {overview.gained30d > 0 ? (
                <span className="text-zinc-400"> · +{overview.gained30d} in 30d</span>
              ) : null}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Competitor rating / reviews
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-zinc-900">
                {fmtRating(overview.competitorAvgRatingNearby)}
              </span>
              <Star className="h-4 w-4 fill-zinc-300 text-zinc-300" />
            </div>
            <p className="mt-1 text-[13px] text-zinc-600">
              {overview.competitorAvgRatingNearby != null
                ? `Avg nearby (~${overview.nearbyMiles} mi)`
                : "Nearby competitor avg unavailable"}
              {overview.competitorPoolSize != null ? (
                <span className="text-zinc-400">
                  {" "}
                  · pool of {overview.competitorPoolSize}
                </span>
              ) : null}
            </p>
            {competitorNames.length > 0 ? (
              <p className="mt-2 text-[12px] text-zinc-500">
                Tracking: {competitorNames.join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-[13px] leading-snug text-amber-950">
          A competitor may still appear above you in parts of the market — even when your
          reviews look stronger.
        </p>
      </section>

      <section className={cn(cardClass, cardPadding)}>
        <h2 className="text-[14px] font-semibold text-zinc-900">
          Reviews may not be the reason they are outranking you
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-snug text-zinc-600">
          Run a local visibility scan to see where your business actually appears in the Google
          Maps pack across a grid of nearby search locations.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {alreadyHasMaps ? (
            <>
              <Link href={mapsHref} className={btnPrimary}>
                Open Maps Overview
              </Link>
              <Link href={setupHref} className={btnSecondary}>
                Run Another Scan
              </Link>
            </>
          ) : (
            <Link href={setupHref} className={btnPrimary}>
              Run My First Maps Scan
            </Link>
          )}
          <Link href={reputationHref} className={btnSecondary}>
            Back to Reputation Overview
          </Link>
        </div>
      </section>
    </ModulePage>
  );
}
