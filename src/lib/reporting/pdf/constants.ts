/** Bump when PDF layout or metric packaging changes (forces new artifact version). */
export const SINGLE_SCAN_PDF_TEMPLATE_VERSION = "single-scan-pdf-v1";

export const REPORT_ARTIFACT_KINDS = [
  "pdf",
  "map_png",
  "heatmap_png",
  "summary_csv",
  "points_csv",
] as const;

export type ReportArtifactKind = (typeof REPORT_ARTIFACT_KINDS)[number];

export type CompetitorLimit = 10 | 20 | "all";

export function artifactContentType(kind: ReportArtifactKind): string {
  switch (kind) {
    case "pdf":
      return "application/pdf";
    case "map_png":
    case "heatmap_png":
      return "image/png";
    case "summary_csv":
    case "points_csv":
      return "text/csv; charset=utf-8";
  }
}

export function artifactFileExtension(kind: ReportArtifactKind): string {
  switch (kind) {
    case "pdf":
      return "pdf";
    case "map_png":
    case "heatmap_png":
      return "png";
    case "summary_csv":
    case "points_csv":
      return "csv";
  }
}
