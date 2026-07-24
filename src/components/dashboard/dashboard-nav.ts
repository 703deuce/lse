import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  Bot,
  Briefcase,
  Building2,
  ClipboardList,
  FileSearch,
  FileText,
  FolderKanban,
  Gauge,
  Grid3X3,
  History,
  KeyRound,
  LayoutDashboard,
  Link2,
  Map,
  MapPin,
  MessageSquareText,
  Palette,
  QrCode,
  Settings,
  Settings2,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import { toolHref, type LocationToolSlug } from "@/lib/dashboard/tool-modules";
import type { LifecyclePhase } from "@/lib/workflow/lifecycle";

export type SidebarNavChild = {
  href: string;
  label: string;
  badge?: string;
};

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isRankGrid?: boolean;
  badge?: string;
  children?: SidebarNavChild[];
};

export type SidebarNavSection = {
  title: string;
  items: SidebarNavItem[];
};

export type SidebarNavGroup = {
  title: string;
  items: SidebarNavItem[];
};

export type SidebarReputationNav = {
  title: string;
  /** Flattened items for mobile / back-compat */
  items: SidebarNavItem[];
  /** Grouped Intelligence / Growth / Automation / Configuration */
  groups: SidebarNavGroup[];
  /** Top-level Overview item (shown above groups) */
  overview: SidebarNavItem;
  subLinks: SidebarNavChild[];
};

export type SidebarLifecycleOptions = {
  /** When set, Local Visibility expands after first Maps scan. */
  mapsActivated?: boolean;
  /** Hide Get started once a business is past onboarding. */
  phase?: LifecyclePhase | null;
};

function loc(slug: LocationToolSlug, businessId?: string | null): string {
  return toolHref(slug, businessId);
}

/**
 * One sidebar for the whole app.
 *
 * Customer lifecycle structure (when a location is selected):
 * Overview → Reputation → Grow Reviews → Local Visibility → Account
 *
 * Work / Growth Tools / Deliverables remain for consultant org workflows.
 */
export function buildUnifiedSidebarNav(
  businessId?: string | null,
  options?: SidebarLifecycleOptions
): {
  getStarted: SidebarNavItem | null;
  overview: SidebarNavItem | null;
  work: SidebarNavSection;
  /** @deprecated Kept for callers that still destructure; menu structure is stable. */
  thisLocation: SidebarNavSection | null;
  growthTools: SidebarNavSection;
  reputation: SidebarReputationNav;
  growReviews: SidebarNavSection;
  localVisibility: SidebarNavSection;
  deliverables: SidebarNavSection;
  account: SidebarNavSection;
} {
  const mapsActivated = Boolean(options?.mapsActivated);
  const phase = options?.phase ?? null;
  const showGetStarted = !phase || phase === "needs_onboarding";

  const overview: SidebarNavItem | null = businessId
    ? {
        href: loc("review-overview", businessId),
        label: "Overview",
        icon: Sparkles,
      }
    : null;

  const workItems: SidebarNavItem[] = [
    { href: "/workspace", label: "Workspace", icon: Briefcase },
    {
      href: "/prospects",
      label: "Prospects",
      icon: Users,
      children: [
        { href: "/prospects", label: "All prospects" },
        { href: "/prospects/audits", label: "Prospect audits" },
      ],
    },
    { href: "/clients", label: "Clients", icon: Building2 },
    {
      href: loc("dashboard", businessId),
      label: "Dashboard",
      icon: LayoutDashboard,
    },
  ];

  const thisLocation: SidebarNavSection | null = null;

  const reputationItems: SidebarNavItem[] = [
    { href: loc("reviews", businessId), label: "Reviews", icon: Star },
    { href: loc("review-analytics", businessId), label: "Review Velocity", icon: TrendingUp },
    { href: loc("review-competitors", businessId), label: "Competitors", icon: Swords },
    { href: loc("review-insights", businessId), label: "Insights", icon: Gauge },
    { href: loc("reputation-audit", businessId), label: "Reputation Audit", icon: FileSearch },
  ];

  const growReviewsItems: SidebarNavItem[] = [
    {
      href: loc("review-requests", businessId),
      label: "Review Requests",
      icon: MessageSquareText,
    },
    { href: loc("review-campaigns", businessId), label: "Campaigns", icon: FolderKanban },
    { href: loc("contacts", businessId), label: "Contacts", icon: Users },
    { href: loc("integrations", businessId), label: "Automations", icon: Webhook },
    { href: loc("review-templates", businessId), label: "Templates", icon: FileText },
    { href: loc("review-qr", businessId), label: "QR Poster", icon: QrCode },
  ];

  const localVisibilityItems: SidebarNavItem[] = mapsActivated
    ? [
        {
          href: businessId ? `/businesses/${businessId}/maps` : "/scans",
          label: "Maps Overview",
          icon: Map,
        },
        {
          href: loc("maps-scans", businessId),
          label: "Rank Scans",
          icon: Grid3X3,
          isRankGrid: true,
        },
        {
          href: loc("keywords", businessId),
          label: "Keywords",
          icon: KeyRound,
        },
        {
          href: businessId ? `/businesses/${businessId}/scans` : "/scans",
          label: "Grid Reports",
          icon: History,
        },
        {
          href: businessId
            ? `/businesses/${businessId}/maps/competitors`
            : loc("maps-scans", businessId),
          label: "Maps Competitors",
          icon: Swords,
        },
        {
          href: businessId
            ? `/businesses/${businessId}/maps/profile`
            : loc("growth-audit", businessId),
          label: "Profile Analysis",
          icon: FileSearch,
        },
      ]
    : [
        {
          href: businessId
            ? `/businesses/${businessId}/local-visibility`
            : "/scans/new",
          label: "Check Maps Rankings",
          icon: MapPin,
        },
      ];

  return {
    getStarted: showGetStarted
      ? {
          href: "/onboarding",
          label: "Get started",
          icon: MapPin,
        }
      : null,
    overview,
    work: {
      title: "Work",
      items: workItems,
    },
    thisLocation,
    growthTools: {
      title: "Growth Tools",
      items: [
        { href: loc("growth-audit", businessId), label: "Growth Audit", icon: FileSearch },
        { href: loc("backlink-gap", businessId), label: "Backlink Gap", icon: Link2 },
        { href: loc("trust", businessId), label: "Local Trust", icon: Award },
        { href: loc("ai-visibility", businessId), label: "AI Visibility", icon: Bot },
      ],
    },
    reputation: {
      title: "Reputation",
      overview: overview ?? {
        href: loc("review-overview", businessId),
        label: "Overview",
        icon: Sparkles,
      },
      // Groups kept for back-compat; sidebar renders flat Reputation + Grow Reviews sections.
      groups: [{ title: "Reputation", items: reputationItems }],
      items: reputationItems,
      subLinks: [],
    },
    growReviews: {
      title: "Grow Reviews",
      items: growReviewsItems,
    },
    localVisibility: {
      title: "Local Visibility",
      items: localVisibilityItems,
    },
    deliverables: {
      title: "Deliverables",
      items: [
        { href: loc("reports", businessId), label: "Reports", icon: FileText },
        { href: loc("tasks", businessId), label: "Growth Plan", icon: ClipboardList },
      ],
    },
    account: {
      title: "Account",
      items: [
        { href: loc("review-alerts", businessId), label: "Alerts", icon: Bell },
        { href: loc("integrations", businessId), label: "Integrations", icon: Webhook },
        { href: loc("review-settings", businessId), label: "Settings", icon: Settings2 },
        { href: "/branding", label: "Branding", icon: Palette },
        { href: "/settings", label: "Account Settings", icon: Settings },
      ],
    },
  };
}

/** @deprecated Use buildUnifiedSidebarNav */
export function buildBusinessSidebarNav(businessId: string): {
  work: SidebarNavSection;
  growthTools: SidebarNavSection;
  reputation: SidebarReputationNav;
  deliverables: SidebarNavSection;
  main: SidebarNavSection;
  research: SidebarNavSection;
  reports: SidebarNavSection;
} {
  const nav = buildUnifiedSidebarNav(businessId);
  return {
    work: nav.work,
    growthTools: nav.growthTools,
    reputation: nav.reputation,
    deliverables: nav.deliverables,
    main: nav.work,
    research: nav.growthTools,
    reports: nav.deliverables,
  };
}

export function isSidebarHrefActive(
  pathname: string,
  href: string,
  businessId?: string | null,
  flags?: { isRankGrid?: boolean; exact?: boolean }
): boolean {
  if (flags?.isRankGrid) {
    if (businessId && pathname.includes(`/businesses/${businessId}/grid/`)) return true;
    // Do not treat org /scans (Recent Scans) as Maps Scans.
    if (pathname === "/scans" || pathname.startsWith("/scans?")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (href === "/scans") {
    return pathname === "/scans" || pathname.startsWith("/scans?");
  }

  if (href === "/clients") {
    return (
      pathname === "/clients" ||
      pathname.startsWith("/clients/") ||
      pathname === "/agency/clients"
    );
  }

  // Prospects hierarchy: All prospects vs Prospect audits (nested under Prospects)
  if (href === "/prospects/audits") {
    return (
      pathname === "/prospects/audits" ||
      pathname.startsWith("/prospects/audits?") ||
      /^\/prospects\/[^/]+\/audit(?:\/|$|\?)/.test(pathname)
    );
  }
  if (href === "/prospects" && flags?.exact) {
    return pathname === "/prospects" || pathname.startsWith("/prospects?");
  }
  if (href === "/prospects") {
    // "All prospects" child — list + prospect overview, not audit routes
    if (pathname === "/prospects" || pathname.startsWith("/prospects?")) return true;
    if (/^\/prospects\/audits(?:\/|$|\?)/.test(pathname)) return false;
    if (/^\/prospects\/[^/]+\/audit(?:\/|$|\?)/.test(pathname)) return false;
    return /^\/prospects\/[^/]+\/?$/.test(pathname);
  }

  // Workspace home (org) — never treat client overview as Workspace
  if (href === "/workspace" || href === "/dashboard") {
    return (
      pathname === "/workspace" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/workspace?")
    );
  }

  // Dashboard — picker or location overview only (not CRM /clients|/prospects detail)
  // Exact location dashboard: .../overview — not .../reputation/overview
  if (
    href === "/tools/go/dashboard" ||
    (businessId && href === `/businesses/${businessId}/overview`)
  ) {
    if (pathname === "/tools/go/dashboard") return true;
    if (businessId && pathname === `/businesses/${businessId}/overview`) {
      return true;
    }
    return false;
  }

  // Review Overview intelligence page (exact; not other /reputation/*)
  if (businessId && href === `/businesses/${businessId}/reputation/overview`) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

  // Maps overview
  if (businessId && href === `/businesses/${businessId}/maps`) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

  // Local visibility bridge
  if (businessId && href === `/businesses/${businessId}/local-visibility`) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

  // Reputation audit — exact match so it doesn't steal /reputation/overview etc.
  if (businessId && href === `/businesses/${businessId}/reputation/audit`) {
    return pathname === href || pathname.startsWith(`${href}?`) || pathname.startsWith(`${href}/`);
  }

  if (href === "/onboarding") {
    return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  }

  if (
    flags?.exact ||
    href.endsWith("/review-requests") ||
    href.endsWith("/reputation/requests") ||
    href.endsWith("/tools/go/review-requests") ||
    href.endsWith("/reputation/qr") ||
    href.endsWith("/tools/go/review-qr")
  ) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

  if (href.includes("?tab=")) {
    const pathOnly = href.split("?")[0] ?? href;
    return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
