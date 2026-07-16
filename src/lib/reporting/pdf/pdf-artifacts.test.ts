import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REPORT_ARTIFACT_KINDS,
  SINGLE_SCAN_PDF_TEMPLATE_VERSION,
  artifactContentType,
  artifactFileExtension,
  type CompetitorLimit,
  type ReportArtifactKind,
} from "@/lib/reporting/pdf/constants";
import { gridPointSpacingMeters, zoomForRadiusMeters } from "@/lib/reporting/pdf/mercator";
import { singleScanPointsCsv, singleScanSummaryCsv } from "@/lib/reporting/scan-csv";
import type { SingleScanReportPayload } from "@/lib/reporting/types";
import { renderHeatmapGridPng } from "@/lib/reporting/pdf/render-heatmap-image";

function brandingVersionFromWhiteLabel(wl: { companyName?: string }): string {
  return wl.companyName ?? "";
}

function artifactIdentityKey(params: {
  kind: ReportArtifactKind;
  scanBatchId: string;
  competitorLimit?: CompetitorLimit;
  brandingVersion: string;
  dataVersion: string;
}): string {
  const limit = params.competitorLimit ?? 20;
  return [
    params.kind,
    "single_scan",
    params.scanBatchId,
    SINGLE_SCAN_PDF_TEMPLATE_VERSION,
    `comp:${limit}`,
    `brand:${params.brandingVersion.slice(0, 64)}`,
    `data:${params.dataVersion}`,
  ].join(":");
}

function samplePayload(gridSize: number): SingleScanReportPayload {
  const cells = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const rank = ((row + col) % 21) || null;
      cells.push({
        label: `${String.fromCharCode(65 + row)}${col + 1}`,
        row,
        col,
        rank: rank === 0 ? null : rank,
        color: "#0B7A29",
        textColor: "#ffffff",
      });
    }
  }
  return {
    reportType: "single_scan",
    business: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Test Business",
      address: "123 Main St",
      category: "Junk removal service",
      rating: 4.8,
      reviewCount: 120,
      placeId: null,
      mapsUrl: null,
    },
    parameters: {
      keyword: "junk removal",
      scannedAt: new Date().toISOString(),
      gridSize,
      radiusMeters: 8047,
      pointCount: gridSize * gridSize,
      platform: "maps",
      centerLabel: "Woodbridge",
      scanId: "00000000-0000-0000-0000-000000000099",
    },
    kpis: {
      arp: 4.5,
      atrp: 5.2,
      solv: 26,
      top3Pct: 26,
      top10Pct: 100,
      notFoundPct: 0,
      visibilityScore: 100,
      bestRank: 1,
      worstRank: 12,
      totalCells: gridSize * gridSize,
      foundCells: gridSize * gridSize,
    },
    heatmap: { gridSize, cells },
    competitors: [
      {
        key: "you",
        name: "Test Business",
        arp: 4.5,
        atrp: 5.2,
        solv: 26,
        top3Appearances: 13,
        totalCells: gridSize * gridSize,
        appearancePct: 100,
        isTarget: true,
      },
    ],
    rankDistribution: [
      { label: "1-3", count: 13 },
      { label: "4-10", count: 36 },
      { label: "11-20", count: 0 },
      { label: "20+/Not found", count: 0 },
    ],
    whiteLabel: { companyName: "Maps Growth Agent", accentColor: "#059669" },
    generatedAt: new Date().toISOString(),
  };
}

describe("scan PDF artifacts", () => {
  it("exposes all download kinds with content types", () => {
    assert.deepEqual([...REPORT_ARTIFACT_KINDS], [
      "pdf",
      "map_png",
      "heatmap_png",
      "summary_csv",
      "points_csv",
    ]);
    assert.equal(artifactContentType("pdf"), "application/pdf");
    assert.equal(artifactFileExtension("map_png"), "png");
    assert.ok(SINGLE_SCAN_PDF_TEMPLATE_VERSION.startsWith("single-scan-pdf"));
  });

  it("builds stable artifact identity keys", () => {
    const a = artifactIdentityKey({
      kind: "pdf",
      scanBatchId: "scan-1",
      competitorLimit: 20,
      brandingVersion: brandingVersionFromWhiteLabel({ companyName: "Acme" }),
      dataVersion: "2026-01-01",
    });
    const b = artifactIdentityKey({
      kind: "pdf",
      scanBatchId: "scan-1",
      competitorLimit: 20,
      brandingVersion: brandingVersionFromWhiteLabel({ companyName: "Acme" }),
      dataVersion: "2026-01-01",
    });
    assert.equal(a, b);
    assert.match(a, /pdf:single_scan:scan-1/);
  });

  it("computes pin spacing and zoom for common grids", () => {
    assert.equal(gridPointSpacingMeters(7, 8047), (2 * 8047) / 6);
    assert.ok(zoomForRadiusMeters(8047, 1280) >= 10);
    assert.ok(zoomForRadiusMeters(8047, 1280) <= 18);
  });

  it("splits summary vs points CSV", () => {
    const payload = samplePayload(3);
    const summary = singleScanSummaryCsv(payload);
    const points = singleScanPointsCsv(payload);
    assert.match(summary, /arp/);
    assert.match(summary, /competitor/);
    assert.doesNotMatch(summary, /^label,row,col,rank/m);
    assert.match(points, /label,row,col,rank/);
    assert.equal(points.split("\n").filter((l) => l.includes(",0,")).length >= 1, true);
  });

  it("renders heatmap PNG for 3×3, 7×7, and 9×9", async () => {
    for (const size of [3, 7, 9]) {
      const buf = await renderHeatmapGridPng({
        gridSize: size,
        cells: samplePayload(size).heatmap.cells,
        cellPx: size >= 9 ? 28 : 40,
      });
      assert.ok(buf.byteLength > 500, `${size}x${size} png too small`);
      assert.equal(buf[0], 0x89); // PNG magic
    }
  });
});
