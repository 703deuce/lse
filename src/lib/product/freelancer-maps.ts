/**
 * Maps product positioning — independent local SEO freelancers (≈1–20 locations).
 *
 * Reputation / review-request campaigns are a separate product and must stay
 * out of the primary Maps navigation.
 */

export const FREELANCER_MAPS_PRODUCT = {
  name: "Maps Rank Tracker",
  tagline: "Unlimited Google Maps rank tracking for freelance local SEO",
  supporting:
    "Run every client and prospect scan you need, track rankings over time, and deliver branded reports without unfinished grids.",
  /** Hide review-request / reputation workflows from the Maps sidebar. */
  hideReputationNav: true,
  /** Prefer location limits over credit-anxiety copy in the UI. */
  hideMapCreditAnxiety: true,
} as const;

export function freelancerMapsProductName(): string {
  return FREELANCER_MAPS_PRODUCT.name;
}
