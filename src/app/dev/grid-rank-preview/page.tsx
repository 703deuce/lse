"use client";

import { useLayoutEffect, useState } from "react";
import { DashboardUIProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebarPanel } from "@/components/dashboard/sidebar";
import { GridScanView } from "@/components/scan/grid-scan-view";
import { ScansHub } from "@/components/scan/scans-hub";
import {
  GRID_RANK_PREVIEW_BUSINESS_ID,
  GRID_RANK_PREVIEW_SCAN_B,
  gridRankPreviewBusinessScans,
  gridRankPreviewCompare,
  gridRankPreviewCompetitors,
  gridRankPreviewHistory,
  gridRankPreviewLatest,
  gridRankPreviewLocations,
  gridRankPreviewScansHub,
  gridRankPreviewStatusForScan,
} from "@/lib/maps/grid-rank-preview-data";

let fetchPatched = false;

function patchGridRankPreviewFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  const bid = GRID_RANK_PREVIEW_BUSINESS_ID;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes(`/api/scans/`) && url.includes("/status")) {
      const scanId = url.match(/\/api\/scans\/([^/]+)\/status/)?.[1] ?? GRID_RANK_PREVIEW_SCAN_B;
      return new Response(JSON.stringify(gridRankPreviewStatusForScan(scanId)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/scans/latest")) {
      return new Response(JSON.stringify(gridRankPreviewLatest), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/locations/${bid}`)) {
      return new Response(JSON.stringify(gridRankPreviewLocations), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/scans/history")) {
      return new Response(JSON.stringify(gridRankPreviewHistory), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.match(/\/api\/scans\/[^/]+\/competitors/)) {
      return new Response(JSON.stringify(gridRankPreviewCompetitors), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes(`/api/businesses/${bid}/scans`)) {
      return new Response(JSON.stringify(gridRankPreviewBusinessScans), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/scans/compare")) {
      return new Response(JSON.stringify(gridRankPreviewCompare(url)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/single-point-rank/")) {
      return new Response(JSON.stringify({ checks: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (
      url.includes("/api/scans/run-for-keyword") ||
      url.includes("/api/scans/keywords/add") ||
      url.includes("/api/scans/create") ||
      url.includes("/api/locations/create")
    ) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return originalFetch(input, init);
  };
}

type PreviewView = "grid" | "scans";

export default function GridRankPreviewPage() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<PreviewView>("grid");

  useLayoutEffect(() => {
    patchGridRankPreviewFetch();
    setReady(true);
  }, []);

  const businessId = GRID_RANK_PREVIEW_BUSINESS_ID;
  const gridPath = `/businesses/${businessId}/grid/${GRID_RANK_PREVIEW_SCAN_B}`;

  if (!ready) return null;

  return (
    <DashboardUIProvider>
    <div className="flex min-h-screen bg-surface-muted">
      <DashboardSidebarPanel
        businessId={businessId}
        pathname={view === "grid" ? gridPath : `/businesses/${businessId}/scans`}
        businessName="Premier Junk Removal"
        staticLinks
        showFooter={false}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-1 border-b border-zinc-200 bg-white px-4 py-1.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
              view === "grid" ? "bg-[#137752] text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Rank Grid
          </button>
          <button
            type="button"
            onClick={() => setView("scans")}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
              view === "scans" ? "bg-[#137752] text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Scans hub
          </button>
        </div>
        {view === "grid" ? (
          <GridScanView businessId={businessId} scanId={GRID_RANK_PREVIEW_SCAN_B} />
        ) : (
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            <ScansHub
              businessId={businessId}
              scans={gridRankPreviewScansHub.scans}
              keywords={gridRankPreviewScansHub.keywords}
              defaultCenterLat={gridRankPreviewScansHub.defaultCenterLat}
              defaultCenterLng={gridRankPreviewScansHub.defaultCenterLng}
              defaultAddress={gridRankPreviewScansHub.defaultAddress}
              businessName={gridRankPreviewScansHub.businessName}
            />
          </main>
        )}
      </div>
    </div>
    </DashboardUIProvider>
  );
}
