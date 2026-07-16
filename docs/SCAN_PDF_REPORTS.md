# Single-scan PDF & export artifacts

Client-facing Local Rank Grid exports (Local Falcon–style packaging).

## Downloads (per completed scan)

| Product | Kind | Worker |
| --- | --- | --- |
| PDF report | `pdf` | `report-generation` |
| Map image | `map_png` | `report-generation` |
| Heatmap image | `heatmap_png` | `report-generation` |
| Scan summary CSV | `summary_csv` | sync or worker |
| Data points CSV | `points_csv` | sync or worker |

HTML **shareable report** remains available (sync generate + reuse) for Print → PDF fallback.

## Deploy

1. Apply migration **`058_report_artifacts.sql`** (adds artifact columns + `reports` storage bucket).
2. Ensure Coolify runs `worker:all` or `worker:reports` so `report-generation` is consumed.
3. Set a Google Maps API key (`MAPS` / `GOOGLE_MAPS_API_KEY`) with **Static Maps** enabled for geo map images. Without it, map pages fall back to a plain canvas with bubbles.

## Caching

Artifacts are keyed by scan id + template version + branding version + data version + competitor limit. Repeated downloads reuse the stored object via a short-lived signed URL.

## Metrics

PDF KPIs reuse `buildSingleScanReport` / `kpisFromRanks` (ARP, ATRP, SoLV, visibility) — same as the scan CSV and HTML report.
