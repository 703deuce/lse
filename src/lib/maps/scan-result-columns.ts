/**
 * Column sets for scan_results reads.
 * Always omit provider_request_json outside debug — it is large and unused by grid UI.
 */

/** Full grid / status payload (matches ScanResultRow + created_at for dedupe). */
export const SCAN_RESULT_GRID_COLUMNS =
  "id, scan_point_id, keyword_id, target_rank, target_found, check_url, source_timestamp, confidence, top_competitors_json, created_at";

/** Competitor aggregation + integrity / sparse checks. */
export const SCAN_RESULT_COMPETITOR_COLUMNS =
  "scan_point_id, keyword_id, target_rank, target_found, top_competitors_json";

/** Rank aggregates only. */
export const SCAN_RESULT_RANK_COLUMNS = "scan_point_id, keyword_id, target_rank";
