/**
 * Location-scoped tools that need a businessId.
 * Org nav links to `/tools/go/{slug}` when no location is selected.
 */
export const LOCATION_TOOL_MODULES = {
  dashboard: {
    title: "Dashboard",
    path: "overview",
    description: "Performance snapshot for a client or prospect location.",
  },
  "maps-scans": {
    title: "Maps Scans",
    path: "scans",
    description: "Run and review Maps rank grids for this location.",
  },
  "maps-campaigns": {
    title: "Maps Campaigns",
    path: "campaigns",
    description: "Group keywords and schedule recurring Maps scans.",
  },
  "growth-audit": {
    title: "Growth Audit",
    path: "growth-audit",
    description: "Find gaps across profile, website, coverage, and competitors.",
  },
  "backlink-gap": {
    title: "Backlink Gap",
    path: "backlink-gap",
    description: "Compare competitors to find backlink opportunities.",
  },
  trust: {
    title: "Local Trust",
    path: "trust",
    description: "Discover local credibility and market opportunities.",
  },
  keywords: {
    title: "Keywords",
    path: "keywords",
    description: "Research terms and decide what to track.",
  },
  "ai-visibility": {
    title: "AI Visibility",
    path: "ai-visibility",
    description: "Track whether AI engines mention this business.",
  },
  "review-overview": {
    title: "Review Overview",
    path: "reputation/overview",
    description: "High-level review intelligence dashboard.",
  },
  reviews: {
    title: "Review Feed",
    path: "reviews",
    description: "Monitor your reviews and competitor review activity.",
  },
  "review-momentum": {
    title: "Review Momentum",
    path: "review-momentum",
    description: "Compare review velocity and rating trends.",
  },
  "review-requests": {
    title: "Review Requests",
    path: "review-requests",
    description: "Send SMS and email review request campaigns.",
  },
  contacts: {
    title: "Contacts",
    path: "contacts",
    description: "Manage contacts for review requests.",
  },
  "review-templates": {
    title: "Templates",
    path: "review-templates",
    description: "Review request message templates.",
  },
  integrations: {
    title: "Review Triggers",
    path: "integrations",
    description: "Automations that start review request flows.",
  },
  "review-settings": {
    title: "Review Settings",
    path: "review-settings",
    description: "Reputation module settings for this location.",
  },
  reports: {
    title: "Reports",
    path: "reports",
    description: "Build and share client reports.",
  },
  tasks: {
    title: "Growth Plan",
    path: "tasks",
    description: "Action plan and tasks for this location.",
  },
} as const;

export type LocationToolSlug = keyof typeof LOCATION_TOOL_MODULES;

export function isLocationToolSlug(value: string): value is LocationToolSlug {
  return value in LOCATION_TOOL_MODULES;
}

export function toolHref(slug: LocationToolSlug, businessId?: string | null): string {
  const mod = LOCATION_TOOL_MODULES[slug];
  if (businessId) return `/businesses/${businessId}/${mod.path}`;
  // Prefer existing org hubs where we already have them.
  if (slug === "dashboard") return "/tools/go/dashboard";
  if (slug === "ai-visibility") return "/ai-visibility";
  if (slug === "reports") return "/reports";
  return `/tools/go/${slug}`;
}
