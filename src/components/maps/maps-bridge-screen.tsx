"use client";

import Link from "next/link";
import { ArrowRight, Check, MapPin, Star, TrendingUp } from "lucide-react";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";

export type MapsBridgeScreenProps = {
  businessId: string;
  businessName: string;
  overview: ReviewOverviewData;
  hasMapsScan?: boolean;
};

const REPORT_ITEMS = [
  "Google Maps Ranking Heatmap",
  "Competitor Comparison",
  "Keyword Analysis",
  "Actionable Improvement Plan",
] as const;

export function MapsBridgeScreen({
  businessId,
  businessName,
  overview,
  hasMapsScan = false,
}: MapsBridgeScreenProps) {
  const setupHref = `/businesses/${businessId}/maps/setup`;
  const mapsHref = `/businesses/${businessId}/maps`;
  const alreadyHasMaps = overview.hasMapsData || hasMapsScan;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
      <div className={cn(mock.card, "w-full px-6 py-10 text-center sm:px-12 sm:py-12")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#137752]">
          Local Visibility
        </p>
        <h1 className="mx-auto mt-3 max-w-xl text-[28px] font-bold leading-tight tracking-tight text-[#101828] sm:text-[32px]">
          You&apos;re all set with reviews. Now it&apos;s time to build your local visibility.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#667085]">
          {businessName} has a review system running
          {overview.totalReviews > 0
            ? ` with ${overview.totalReviews} Google reviews`
            : ""}
          . Maps rankings show where you actually appear across your service area.
        </p>

        {/* Star + Pin = Growth */}
        <div className="mt-8 flex items-center justify-center gap-3 sm:gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#137752] sm:h-20 sm:w-20">
            <Star className="h-8 w-8 fill-current sm:h-9 sm:w-9" />
          </div>
          <span className="text-2xl font-bold text-[#98A2B3]">+</span>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EFF8FF] text-[#175CD3] sm:h-20 sm:w-20">
            <MapPin className="h-8 w-8 sm:h-9 sm:w-9" />
          </div>
          <span className="text-2xl font-bold text-[#98A2B3]">=</span>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FEF6EE] text-[#C4320A] sm:h-20 sm:w-20">
            <TrendingUp className="h-8 w-8 sm:h-9 sm:w-9" />
          </div>
        </div>
        <p className="mt-3 text-[12px] font-medium text-[#98A2B3]">
          Reputation + Maps visibility = local growth
        </p>

        <div className="mx-auto mt-8 max-w-md rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] px-5 py-5 text-left">
          <p className="text-[13px] font-semibold text-[#101828]">
            What&apos;s inside your Local Visibility Report:
          </p>
          <ul className="mt-3 space-y-2.5">
            {REPORT_ITEMS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#344054]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#137752]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href={alreadyHasMaps ? mapsHref : setupHref}
            className={cn(mock.btnPrimary, "h-12 min-w-[280px] px-6 text-[15px]")}
          >
            {alreadyHasMaps ? "Open Maps Overview" : "Generate My Local Visibility Report"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/businesses/${businessId}/reputation/overview`}
            className="text-sm font-semibold text-[#667085] hover:text-[#137752]"
          >
            Back to Reputation Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
