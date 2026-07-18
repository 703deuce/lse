export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Partial<OrganizationRow> & { name: string };
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: { organization_id: string; user_id: string; role?: string };
        Update: Partial<OrganizationMemberRow>;
        Relationships: [];
      };
      businesses: {
        Row: BusinessRow;
        Insert: BusinessInsert;
        Update: Partial<BusinessRow>;
        Relationships: [];
      };
      business_keywords: {
        Row: BusinessKeywordRow;
        Insert: BusinessKeywordInsert;
        Update: Partial<BusinessKeywordRow>;
        Relationships: [];
      };
      scan_batches: {
        Row: ScanBatchRow;
        Insert: ScanBatchInsert;
        Update: Partial<ScanBatchRow>;
        Relationships: [];
      };
      scan_points: {
        Row: ScanPointRow;
        Insert: ScanPointInsert;
        Update: Partial<ScanPointRow>;
        Relationships: [];
      };
      scan_results: {
        Row: ScanResultRow;
        Insert: ScanResultInsert;
        Update: Partial<ScanResultRow>;
        Relationships: [];
      };
      competitors: {
        Row: CompetitorRow;
        Insert: CompetitorInsert;
        Update: Partial<CompetitorRow>;
        Relationships: [];
      };
      competitor_snapshots: {
        Row: CompetitorSnapshotRow;
        Insert: CompetitorSnapshotInsert;
        Update: Partial<CompetitorSnapshotRow>;
        Relationships: [];
      };
      audits: {
        Row: AuditRow;
        Insert: AuditInsert;
        Update: Partial<AuditRow>;
        Relationships: [];
      };
      audit_findings: {
        Row: AuditFindingRow;
        Insert: AuditFindingInsert;
        Update: Partial<AuditFindingRow>;
        Relationships: [];
      };
      action_plans: {
        Row: ActionPlanRow;
        Insert: ActionPlanInsert;
        Update: Partial<ActionPlanRow>;
        Relationships: [];
      };
      action_items: {
        Row: ActionItemRow;
        Insert: ActionItemInsert;
        Update: Partial<ActionItemRow>;
        Relationships: [];
      };
      provider_runs: {
        Row: ProviderRunRow;
        Insert: ProviderRunInsert;
        Update: Partial<ProviderRunRow>;
        Relationships: [];
      };
      job_queue: {
        Row: JobQueueRow;
        Insert: JobQueueInsert;
        Update: Partial<JobQueueRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: ReportInsert;
        Update: Partial<ReportRow>;
        Relationships: [];
      };
      integrations_google: {
        Row: IntegrationGoogleRow;
        Insert: { organization_id: string };
        Update: Partial<IntegrationGoogleRow>;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; email: string | null; full_name: string | null; avatar_url: string | null; created_at: string; updated_at: string };
        Insert: { id: string; email?: string | null };
        Update: Partial<{ id: string; email: string | null }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface OrganizationRow {
  id: string;
  name: string;
  plan: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  report_logo_url?: string | null;
  report_accent_color?: string | null;
  report_footer_text?: string | null;
  report_contact_line?: string | null;
  report_hide_platform_branding?: boolean;
}

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface BusinessRow {
  id: string;
  organization_id: string;
  name: string;
  website_url: string | null;
  phone: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  cid: string | null;
  primary_category: string | null;
  service_area_mode: string;
  scan_center_lat: number | null;
  scan_center_lng: number | null;
  /** Private app-only address used when the public GBP listing has none. */
  scan_center_label: string | null;
  is_tracked?: boolean;
  tracking_source?: string;
  account_type?: "prospect" | "client";
  prospect_status?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  notes?: string | null;
  tags?: string[];
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessInsert {
  organization_id: string;
  name: string;
  website_url?: string | null;
  phone?: string | null;
  address_text?: string | null;
  lat?: number | null;
  lng?: number | null;
  place_id?: string | null;
  cid?: string | null;
  primary_category?: string | null;
  service_area_mode?: string;
  scan_center_lat?: number | null;
  scan_center_lng?: number | null;
  scan_center_label?: string | null;
}

export interface BusinessKeywordRow {
  id: string;
  business_id: string;
  keyword: string;
  is_primary: boolean;
  city: string | null;
  state: string | null;
  country: string | null;
  language_code: string | null;
  created_at: string;
}

export interface BusinessKeywordInsert {
  business_id: string;
  keyword: string;
  is_primary?: boolean;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  language_code?: string | null;
}

export interface ScanBatchRow {
  id: string;
  business_id: string;
  status: string;
  scan_type: string;
  grid_size: number;
  radius_meters: number;
  device: string | null;
  os: string | null;
  provider: string | null;
  location_id: string | null;
  center_lat: number | null;
  center_lng: number | null;
  center_label: string | null;
  moved_from_scan_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  confidence_summary: Json;
  aggregate_metrics: Json;
  error_message: string | null;
  early_enrichment_started?: boolean;
  lease_owner?: string | null;
  lease_expires_at?: string | null;
  heartbeat_at?: string | null;
  recovery_generation?: number | null;
  next_recovery_at?: string | null;
  last_recovery_at?: string | null;
  recovery_locked_at?: string | null;
  recovery_lock_owner?: string | null;
  recovery_lease_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanBatchInsert {
  business_id: string;
  status?: string;
  scan_type?: string;
  grid_size?: number;
  radius_meters?: number;
  device?: string | null;
  os?: string | null;
  provider?: string | null;
}

export interface ScanPointRow {
  id: string;
  scan_batch_id: string;
  grid_label: string;
  lat: number;
  lng: number;
  distance_from_center_m: number | null;
  cell_status?: string | null;
  total_attempts?: number | null;
  capacity_failures?: number | null;
  actual_search_failures?: number | null;
  last_error_category?: string | null;
  last_error_message?: string | null;
  first_attempt_at?: string | null;
  last_attempt_at?: string | null;
  completed_at?: string | null;
  next_retry_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ScanPointInsert {
  scan_batch_id: string;
  grid_label: string;
  lat: number;
  lng: number;
  distance_from_center_m?: number | null;
}

export interface ScanResultRow {
  id: string;
  scan_point_id: string;
  keyword_id: string;
  target_rank: number | null;
  target_found: boolean;
  check_url: string | null;
  source_timestamp: string | null;
  confidence: string | null;
  top_competitors_json: Json;
  created_at: string;
}

export interface ScanResultInsert {
  scan_point_id: string;
  keyword_id: string;
  target_rank?: number | null;
  target_found?: boolean;
  check_url?: string | null;
  source_timestamp?: string | null;
  confidence?: string | null;
  top_competitors_json?: Json;
}

export interface CompetitorRow {
  id: string;
  cid: string | null;
  place_id: string | null;
  name: string;
  website_url: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface CompetitorInsert {
  name: string;
  cid?: string | null;
  place_id?: string | null;
  website_url?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface CompetitorSnapshotRow {
  id: string;
  scan_batch_id: string;
  competitor_id: string;
  category: string | null;
  additional_categories: Json;
  rating: number | null;
  review_count: number | null;
  photo_count: number | null;
  post_count: number | null;
  services_json: Json;
  attributes_json: Json;
  place_topics_json: Json;
  justifications_json: Json;
  created_at: string;
}

export interface CompetitorSnapshotInsert {
  scan_batch_id: string;
  competitor_id: string;
  category?: string | null;
  rating?: number | null;
  review_count?: number | null;
  photo_count?: number | null;
}

export interface AuditRow {
  id: string;
  business_id: string;
  scan_batch_id: string | null;
  status: string;
  relevance_score: number | null;
  distance_score: number | null;
  prominence_score: number | null;
  trust_score: number | null;
  overall_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditInsert {
  business_id: string;
  scan_batch_id?: string | null;
  status?: string;
}

export interface AuditFindingRow {
  id: string;
  audit_id: string;
  finding_type: string;
  bucket: string;
  severity: string;
  metric_key: string | null;
  metric_value: string | null;
  evidence_json: Json;
  created_at: string;
}

export interface AuditFindingInsert {
  audit_id: string;
  finding_type: string;
  bucket: string;
  severity: string;
  metric_key?: string | null;
  metric_value?: string | null;
  evidence_json?: Json;
}

export interface ActionPlanRow {
  id: string;
  audit_id: string;
  llm_model: string | null;
  summary: string | null;
  status: string;
  created_at: string;
}

export interface ActionPlanInsert {
  audit_id: string;
  llm_model?: string | null;
  summary?: string | null;
  status?: string;
}

export interface ActionItemRow {
  id: string;
  action_plan_id: string;
  title: string;
  description: string | null;
  bucket: string;
  impact: string | null;
  effort: string | null;
  priority_rank: number;
  status: string;
  owner_user_id: string | null;
  due_at: string | null;
  evidence_json: Json;
  created_at: string;
  updated_at: string;
}

export interface ActionItemInsert {
  action_plan_id: string;
  title: string;
  description?: string | null;
  bucket: string;
  impact?: string | null;
  effort?: string | null;
  priority_rank?: number;
  status?: string;
  evidence_json?: Json;
}

export interface ProviderRunRow {
  id: string;
  organization_id: string | null;
  provider: string;
  endpoint: string;
  request_hash: string | null;
  external_task_id: string | null;
  status_code: number | null;
  latency_ms: number | null;
  cost_estimate: number | null;
  raw_request_json: Json;
  raw_response_json: Json;
  created_at: string;
}

export interface ProviderRunInsert {
  provider: string;
  endpoint: string;
  organization_id?: string | null;
  request_hash?: string | null;
  external_task_id?: string | null;
  status_code?: number | null;
  latency_ms?: number | null;
  cost_estimate?: number | null;
  raw_request_json?: Json;
  raw_response_json?: Json;
}

export interface JobQueueRow {
  id: string;
  job_type: string;
  payload: Json;
  status: string;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface JobQueueInsert {
  job_type: string;
  payload?: Json;
  status?: string;
}

export interface ReportRow {
  id: string;
  business_id: string;
  scan_batch_id: string | null;
  storage_path: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  generated_at: string;
  metadata_json: Json;
  html_content?: string | null;
}

export interface ReportInsert {
  business_id: string;
  scan_batch_id?: string | null;
  storage_path?: string | null;
  share_token?: string | null;
  share_expires_at?: string | null;
  metadata_json?: Json;
  html_content?: string | null;
}

export interface IntegrationGoogleRow {
  id: string;
  organization_id: string;
  google_account_id: string | null;
  oauth_status: string | null;
  access_scopes: Json;
  tokens_json: Json;
  api_access_confirmed: boolean | null;
  created_at: string;
  updated_at: string;
}

export type Business = BusinessRow;
export type ScanBatch = ScanBatchRow;
export type ScanPoint = ScanPointRow;
export type ScanResult = ScanResultRow;
export type Audit = AuditRow;
export type AuditFinding = AuditFindingRow;
export type ActionItem = ActionItemRow;
export type ActionPlan = ActionPlanRow;
