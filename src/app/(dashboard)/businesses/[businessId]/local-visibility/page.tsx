import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { MapsBridgeScreen } from "@/components/maps/maps-bridge-screen";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { createServiceClient } from "@/lib/db/client";
import { loadReviewOverviewData } from "@/lib/reviews/review-overview-data";
import { reviewOverviewPreviewData } from "@/lib/reviews/review-overview-preview-data";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";

async function LocalVisibilityLoaded({ businessId }: { businessId: string }) {
  const { business } = await requireBusinessPageData(businessId);
  const supabase = createServiceClient();

  const [overview, mapsScan] = await Promise.all([
    isDevPreviewBusiness(businessId)
      ? Promise.resolve({ ...reviewOverviewPreviewData })
      : loadReviewOverviewData(businessId),
    isDevPreviewBusiness(businessId)
      ? Promise.resolve({ data: null })
      : supabase
          .from("scan_batches")
          .select("id")
          .eq("business_id", businessId)
          .in("status", [...USABLE_SCAN_STATUSES])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
  ]);

  return (
    <MapsBridgeScreen
      businessId={businessId}
      businessName={String(business.name ?? "Business")}
      overview={overview}
      hasMapsScan={Boolean(mapsScan.data?.id)}
    />
  );
}

export default async function LocalVisibilityPage({
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
      <LocalVisibilityLoaded businessId={businessId} />
    </Suspense>
  );
}
