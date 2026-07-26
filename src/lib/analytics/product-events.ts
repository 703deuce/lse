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
  | "branding_completed"
  | "qr_public_opened"
  | "qr_generated"
  | "qr_poster_downloaded"
  | "qr_only_downloaded"
  | "qr_tracked_link_copied"
  | "qr_signup_prompt_shown"
  | "qr_anonymous_claimed"
  | "qr_campaign_created"
  | "qr_campaign_duplicated"
  | "qr_analytics_viewed"
  | "qr_upgrade_prompt_shown";

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
