/**
 * Product analytics for freelancer Maps workflows.
 * Never include report body text or private notes in payloads.
 */

export type ProductEventName =
  | "prospect_created"
  | "client_created"
  | "prospect_converted"
  | "scan_started"
  | "scan_completed"
  | "scan_recovered"
  | "scan_comparison_viewed"
  | "campaign_created"
  | "scheduled_scan_created"
  | "report_draft_created"
  | "report_published"
  | "report_pdf_downloaded"
  | "report_share_link_copied"
  | "shared_report_viewed"
  | "ai_visibility_run_started"
  | "ai_visibility_added_to_report"
  | "branding_completed";

export type ProductEventPayload = {
  organizationId?: string;
  businessId?: string;
  scanId?: string;
  reportId?: string;
  campaignId?: string;
  [key: string]: string | number | boolean | null | undefined;
};

export function trackProductEvent(
  name: ProductEventName,
  payload: ProductEventPayload = {}
): void {
  try {
    // Structured log sink — wire to Segment/PostHog later without changing call sites.
    console.info(
      JSON.stringify({
        type: "product_event",
        name,
        ts: new Date().toISOString(),
        ...payload,
      })
    );
  } catch {
    // never throw from analytics
  }
}
