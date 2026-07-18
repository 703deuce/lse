/**
 * Maps product positioning — independent local SEO consultants managing ~1–20 clients.
 *
 * Reputation / review-request campaigns are a separate product and must stay
 * out of the primary Maps navigation.
 */

export const FREELANCER_MAPS_PRODUCT = {
  name: "Maps Rank Tracker",
  /** Primary positioning line for dashboards and onboarding. */
  tagline:
    "The Google Maps rank-tracking and reporting workspace for independent local SEO consultants.",
  supporting:
    "Audit prospects, track every client, and deliver professional white-label reports—with unlimited Maps scans and no credit math.",
  audienceLine: "Built for independent local SEO consultants managing 1–20 clients.",
  /** Hide review-request / reputation workflows from the Maps sidebar. */
  hideReputationNav: true,
  /** Prefer location limits over credit-anxiety copy in the UI. */
  hideMapCreditAnxiety: true,
} as const;

export function freelancerMapsProductName(): string {
  return FREELANCER_MAPS_PRODUCT.name;
}
