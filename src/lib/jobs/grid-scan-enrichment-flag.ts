/**
 * Grid scans return everything needed from Bright Data (ranks, ratings, review counts).
 * ScrapingDog enrichment (photos/posts/dated reviews) is opt-in only.
 *
 * Set GRID_SCAN_AUTO_ENRICHMENT=true to re-enable auto early + post-scan enrichment.
 * Manual enrichment via POST /api/scans/[scanId]/enrich still works regardless.
 */
export function gridScanAutoEnrichmentEnabled(): boolean {
  return process.env.GRID_SCAN_AUTO_ENRICHMENT === "true";
}
