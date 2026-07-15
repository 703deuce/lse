import { escapeCsv } from "@/lib/reporting/metrics";
import type {
  CompetitorReportPayload,
  LocationReportPayload,
  SingleScanReportPayload,
  TrendReportPayload,
} from "@/lib/reporting/types";

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsv).join(",");
}

export function singleScanToCsv(payload: SingleScanReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["scanned_at", payload.parameters.scannedAt]));
  lines.push(row(["grid_size", payload.parameters.gridSize]));
  lines.push(row(["radius_meters", payload.parameters.radiusMeters]));
  lines.push("");
  lines.push(row(["kpi", "value"]));
  lines.push(row(["arp", payload.kpis.arp]));
  lines.push(row(["atrp", payload.kpis.atrp]));
  lines.push(row(["solv", payload.kpis.solv]));
  lines.push(row(["top3_pct", payload.kpis.top3Pct]));
  lines.push(row(["top10_pct", payload.kpis.top10Pct]));
  lines.push(row(["not_found_pct", payload.kpis.notFoundPct]));
  lines.push(row(["visibility_score", payload.kpis.visibilityScore]));
  lines.push(row(["best_rank", payload.kpis.bestRank]));
  lines.push(row(["worst_rank", payload.kpis.worstRank]));
  lines.push(row(["found_cells", payload.kpis.foundCells]));
  lines.push(row(["total_cells", payload.kpis.totalCells]));
  lines.push("");
  lines.push(row(["label", "row", "col", "rank"]));
  for (const cell of payload.heatmap.cells) {
    lines.push(row([cell.label, cell.row, cell.col, cell.rank]));
  }
  lines.push("");
  lines.push(
    row([
      "competitor",
      "key",
      "is_target",
      "arp",
      "atrp",
      "solv",
      "top3_appearances",
      "appearance_pct",
      "rating",
      "reviews",
    ])
  );
  for (const c of payload.competitors) {
    lines.push(
      row([
        c.name,
        c.key,
        c.isTarget ? "yes" : "no",
        c.arp,
        c.atrp,
        c.solv,
        c.top3Appearances,
        c.appearancePct,
        c.rating ?? null,
        c.reviewCount ?? null,
      ])
    );
  }
  lines.push("");
  lines.push(row(["bucket", "count"]));
  for (const d of payload.rankDistribution) {
    lines.push(row([d.label, d.count]));
  }
  return lines.join("\n");
}

export function trendToCsv(payload: TrendReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["date_from", payload.parameters.dateFrom]));
  lines.push(row(["date_to", payload.parameters.dateTo]));
  lines.push(row(["scan_count", payload.parameters.scanCount]));
  lines.push("");
  lines.push(row(["metric", "current", "previous", "delta"]));
  lines.push(row(["arp", payload.current.arp, payload.previous.arp, payload.deltas.arp]));
  lines.push(row(["atrp", payload.current.atrp, payload.previous.atrp, payload.deltas.atrp]));
  lines.push(row(["solv", payload.current.solv, payload.previous.solv, payload.deltas.solv]));
  lines.push("");
  lines.push(row(["scan_id", "date", "arp", "atrp", "solv", "top3_pct", "top10_pct", "visibility_score"]));
  for (const s of payload.series) {
    lines.push(
      row([
        s.scanId,
        s.date,
        s.arp,
        s.atrp,
        s.solv,
        s.top3Pct,
        s.top10Pct,
        s.visibilityScore,
      ])
    );
  }
  return lines.join("\n");
}

export function competitorsToCsv(payload: CompetitorReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["scanned_at", payload.parameters.scannedAt]));
  lines.push(row(["selected_keys", payload.selectedCompetitorKeys.join("|")]));
  lines.push("");
  lines.push(
    row([
      "name",
      "key",
      "is_target",
      "selected",
      "arp",
      "atrp",
      "solv",
      "top3_appearances",
      "appearance_pct",
      "rating",
      "reviews",
      "category",
    ])
  );
  const selected = new Set(payload.selectedCompetitorKeys);
  for (const c of payload.competitors) {
    lines.push(
      row([
        c.name,
        c.key,
        c.isTarget ? "yes" : "no",
        selected.has(c.key) || c.isTarget ? "yes" : "no",
        c.arp,
        c.atrp,
        c.solv,
        c.top3Appearances,
        c.appearancePct,
        c.rating ?? null,
        c.reviewCount ?? null,
        c.category ?? null,
      ])
    );
  }
  return lines.join("\n");
}

export function locationToCsv(payload: LocationReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["date_from", payload.parameters.dateFrom]));
  lines.push(row(["date_to", payload.parameters.dateTo]));
  lines.push(row(["keyword_count", payload.parameters.keywordCount]));
  lines.push(row(["aggregate_arp", payload.aggregate.arp]));
  lines.push(row(["aggregate_atrp", payload.aggregate.atrp]));
  lines.push(row(["aggregate_solv", payload.aggregate.solv]));
  lines.push(row(["rising", payload.rising.join("|")]));
  lines.push(row(["falling", payload.falling.join("|")]));
  lines.push("");
  lines.push(
    row(["keyword", "keyword_id", "scan_id", "scanned_at", "arp", "atrp", "solv", "change_arp"])
  );
  for (const k of payload.keywords) {
    lines.push(
      row([
        k.keyword,
        k.keywordId,
        k.scanId,
        k.scannedAt,
        k.arp,
        k.atrp,
        k.solv,
        k.changeArp,
      ])
    );
  }
  return lines.join("\n");
}
