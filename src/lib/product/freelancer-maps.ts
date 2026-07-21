/**
 * Maps product positioning — independent local SEO consultants managing ~1–20 clients.
 *
 * Freelancer CRM (prospects/clients/campaigns/workspace queue) is additive.
 * Existing modules (Local Trust, Reviews, Review Momentum, Review Requests, etc.)
 * stay in the main menu — do not strip them for positioning.
 */

export const FREELANCER_MAPS_PRODUCT = {
  name: "Local SEO Express",
  /** Primary positioning line for dashboards and onboarding. */
  tagline:
    "The Google Maps rank-tracking and reporting workspace for independent local SEO consultants.",
  supporting:
    "Audit prospects, track every client, and deliver professional white-label reports—with unlimited Maps scans and no credit math.",
  audienceLine: "Built for independent local SEO consultants managing 1–20 clients.",
  /**
   * Kept for settings copy only. Navigation always shows the full module menu;
   * review-request product access is gated by plan/permissions on the page itself.
   */
  hideReputationNav: false,
  /** Prefer location limits over credit-anxiety copy in the UI. */
  hideMapCreditAnxiety: true,
} as const;

export function freelancerMapsProductName(): string {
  return FREELANCER_MAPS_PRODUCT.name;
}
