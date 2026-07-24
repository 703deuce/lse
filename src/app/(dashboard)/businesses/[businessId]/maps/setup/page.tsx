import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { FirstMapsSetup } from "@/components/maps/first-maps-setup";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { createServiceClient } from "@/lib/db/client";
import { loadReviewOverviewData } from "@/lib/reviews/review-overview-data";
import { reviewOverviewPreviewData } from "@/lib/reviews/review-overview-preview-data";

async function FirstMapsSetupLoaded({ businessId }: { businessId: string }) {
  const { business } = await requireBusinessPageData(businessId);
  const supabase = createServiceClient();

  const [{ data: keywords }, overview] = await Promise.all([
    isDevPreviewBusiness(businessId)
      ? Promise.resolve({
          data: [
            { id: "preview-kw-1", keyword: "local service", is_primary: true },
          ],
        })
      : supabase
          .from("business_keywords")
          .select("id, keyword, is_primary, active")
          .eq("business_id", businessId)
          .neq("active", false)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
    isDevPreviewBusiness(businessId)
      ? Promise.resolve(reviewOverviewPreviewData)
      : loadReviewOverviewData(businessId).catch(() => null),
  ]);

  const reviewsLookStrong =
    overview != null &&
    overview.googleRating != null &&
    (overview.competitorAvgRatingNearby == null ||
      overview.googleRating >= overview.competitorAvgRatingNearby) &&
    overview.totalReviews > 0;

  return (
    <FirstMapsSetup
      businessId={businessId}
      business={{
        id: business.id as string,
        name: String(business.name ?? "Business"),
        placeId: (business.place_id as string | null) ?? null,
        addressText: (business.address_text as string | null) ?? null,
        scanCenterLabel: (business.scan_center_label as string | null) ?? null,
        primaryCategory: (business.primary_category as string | null) ?? null,
        websiteUrl: (business.website_url as string | null) ?? null,
        phone: (business.phone as string | null) ?? null,
        lat: (business.lat as number | null) ?? null,
        lng: (business.lng as number | null) ?? null,
        scanCenterLat: (business.scan_center_lat as number | null) ?? null,
        scanCenterLng: (business.scan_center_lng as number | null) ?? null,
        serviceAreaMode: (business.service_area_mode as string | null) ?? null,
      }}
      keywords={(keywords ?? []).map((k) => ({
        id: k.id as string,
        keyword: String(k.keyword).trim(),
        isPrimary: !!k.is_primary,
      }))}
      reviewsLookStrong={reviewsLookStrong}
    />
  );
}

export default async function MapsSetupPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#137752]" />
        </div>
      }
    >
      <FirstMapsSetupLoaded businessId={businessId} />
    </Suspense>
  );
}
