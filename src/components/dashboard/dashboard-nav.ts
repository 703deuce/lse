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
  LayoutDashboard,
  Link2,
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

function loc(slug: LocationToolSlug, businessId?: string | null): string {
  return toolHref(slug, businessId);
}

/**
 * One sidebar for the whole app.
 *
 * Naming rules:
 * - Workspace = org home (clients, prospects, work queue)
 * - Dashboard = always under Work (picker if no location; overview if selected)
 * - Never under Account; never appears/disappears when switching locations
 */
export function buildUnifiedSidebarNav(businessId?: string | null): {
  getStarted: SidebarNavItem;
  work: SidebarNavSection;
  /** @deprecated Kept for callers that still destructure; menu structure is stable. */
  thisLocation: SidebarNavSection | null;
  growthTools: SidebarNavSection;
  reputation: SidebarReputationNav;
  deliverables: SidebarNavSection;
  account: SidebarNavSection;
} {
  // Dashboard always stays under Work in the same slot — never disappears / pops
  // into another section when a client is selected. No location → picker; with
  // location → that client's overview.
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

  workItems.push(
    {
      href: loc("maps-scans", businessId),
      label: "Maps Scans",
      icon: Grid3X3,
      isRankGrid: true,
    },
    {
      href: loc("maps-campaigns", businessId),
      label: "Maps Campaigns",
      icon: FolderKanban,
    },
    {
      href: "/scans",
      label: "Recent Scans",
      icon: History,
    }
  );

  const thisLocation: SidebarNavSection | null = null;

  return {
    getStarted: {
      href: "/onboarding",
      label: "Get started",
      icon: MapPin,
    },
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
    reputation: (() => {
      const overview: SidebarNavItem = {
        href: loc("review-overview", businessId),
        label: "Overview",
        icon: Sparkles,
      };
      const groups: SidebarNavGroup[] = [
        {
          title: "Intelligence",
          items: [
            { href: loc("reviews", businessId), label: "Reviews", icon: Star },
            { href: loc("review-analytics", businessId), label: "Review Velocity", icon: TrendingUp },
            { href: loc("review-competitors", businessId), label: "Competitors", icon: Swords },
            { href: loc("review-insights", businessId), label: "Insights", icon: Gauge },
            {
              href: loc("reputation-audit", businessId),
              label: "Reputation Audit",
              icon: FileSearch,
            },
          ],
        },
        {
          title: "Growth",
          items: [
            {
              href: loc("review-requests", businessId),
              label: "Review Requests",
              icon: MessageSquareText,
            },
            { href: loc("review-qr", businessId), label: "QR Poster", icon: QrCode },
            { href: loc("review-campaigns", businessId), label: "Campaigns", icon: FolderKanban },
            { href: loc("review-templates", businessId), label: "Templates", icon: FileText },
            { href: loc("contacts", businessId), label: "Contacts", icon: Users },
          ],
        },
        {
          title: "Automation",
          items: [
            { href: loc("integrations", businessId), label: "Automations", icon: Webhook },
            { href: loc("review-alerts", businessId), label: "Alerts", icon: Bell },
          ],
        },
        {
          title: "Configuration",
          items: [
            {
              href: loc("review-settings", businessId),
              label: "Reputation Settings",
              icon: Settings2,
            },
          ],
        },
      ];
      return {
        title: "Reputation",
        overview,
        groups,
        items: [overview, ...groups.flatMap((g) => g.items)],
        subLinks: [],
      };
    })(),
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
        { href: "/branding", label: "Branding", icon: Palette },
        { href: "/settings", label: "Settings", icon: Settings },
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
