export type ScanListItem = {
  id: string;
  status: string;
  grid_size: number;
  radius_meters: number;
  created_at: string;
  finished_at: string | null;
  center_label: string | null;
  keyword: string | null;
  keyword_id: string | null;
  aggregate_metrics: {
    averageRank?: number | null;
    top3Cells?: number;
    totalCells?: number;
    visibilityScore?: number | null;
  } | null;
};

export type KeywordOption = {
  id: string;
  keyword: string;
  is_primary?: boolean;
  search_volume?: number | null;
  last_scan_at?: string | null;
  latest_scan_id?: string | null;
  latest_center_label?: string | null;
  latest_average_rank?: number | null;
  latest_top3_pct?: number | null;
  latest_visibility_score?: number | null;
  change?: number | null;
};
