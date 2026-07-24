"use client";

import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { FirstMapsSetup } from "@/components/maps/first-maps-setup";
import { REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID } from "@/lib/reviews/review-overview-preview-data";

export default function WorkflowMapsSetupPreview() {
  const biz = REVIEW_OVERVIEW_PREVIEW_BUSINESS_ID;
  const path = `/businesses/${biz}/maps/setup`;

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <DashboardSidebarPanel
        businessId={biz}
        pathname={path}
        businessName="Junk Removal Woodbridge"
        staticLinks
        showFooter={false}
        mapsActivated={false}
        phase="reputation_ready"
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
        <FirstMapsSetup
          businessId={biz}
          business={{
            id: biz,
            name: "Junk Removal Woodbridge",
            placeId: "ChIJpreview",
            addressText: "123 Main St, Woodbridge, VA 22191",
            scanCenterLabel: "Woodbridge, VA",
            primaryCategory: "Junk removal service",
            websiteUrl: "https://example.com",
            phone: "(703) 555-0142",
            lat: 38.6582,
            lng: -77.2497,
            scanCenterLat: 38.6582,
            scanCenterLng: -77.2497,
            serviceAreaMode: "service_area",
          }}
          keywords={[
            { id: "k1", keyword: "Junk removal", isPrimary: true },
            { id: "k2", keyword: "Junk removal Woodbridge VA", isPrimary: false },
            { id: "k3", keyword: "Furniture removal", isPrimary: false },
          ]}
          reviewsLookStrong
        />
      </main>
    </div>
  );
}
