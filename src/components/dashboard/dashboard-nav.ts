import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bot,
  Briefcase,
  Building2,
  ClipboardList,
  FileSearch,
  FileText,
  FolderKanban,
  Grid3X3,
  KeyRound,
  LayoutDashboard,
  Link2,
  MapPin,
  MessageSquareText,
  Palette,
  Settings,
  Settings2,
  Star,
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

export type SidebarReputationNav = {
  title: string;
  items: SidebarNavItem[];
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
  /** Present only when a client/prospect location is selected */
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
    { href: "/prospects", label: "Prospects", icon: Users },
    { href: "/clients", label: "Clients", icon: Building2 },
    {
      href: loc("dashboard", businessId),
      label: "Dashboard",
      icon: LayoutDashboard,
    },
  ];

  // Maps stay under Work when nothing is selected (pickers). When a location is
  // selected they move under "This location" with scoped links — Dashboard does not.
  if (!businessId) {
    workItems.push(
      {
        href: loc("maps-scans", null),
        label: "Maps Scans",
        icon: Grid3X3,
        isRankGrid: true,
      },
      {
        href: loc("maps-campaigns", null),
        label: "Maps Campaigns",
        icon: FolderKanban,
      }
    );
  }

  const thisLocation: SidebarNavSection | null = businessId
    ? {
        title: "This location",
        items: [
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
        ],
      }
    : null;

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
        { href: loc("keywords", businessId), label: "Keywords", icon: KeyRound },
        { href: loc("ai-visibility", businessId), label: "AI Visibility", icon: Bot },
      ],
    },
    reputation: {
      title: "Reputation",
      items: [
        { href: loc("reviews", businessId), label: "Review Feed", icon: Star },
        { href: loc("review-momentum", businessId), label: "Review Momentum", icon: TrendingUp },
        {
          href: loc("review-requests", businessId),
          label: "Review Requests",
          icon: MessageSquareText,
          badge: "Add-on",
          children: [
            {
              href: businessId
                ? `/businesses/${businessId}/review-campaigns`
                : "/tools/go/review-requests",
              label: "Campaigns",
              badge: "Upgrade",
            },
          ],
        },
        { href: loc("contacts", businessId), label: "Contacts", icon: Users },
        { href: loc("review-templates", businessId), label: "Templates", icon: FileText },
        { href: loc("integrations", businessId), label: "Review Triggers", icon: Webhook },
        {
          href: loc("review-settings", businessId),
          label: "Review settings",
          icon: Settings2,
        },
      ],
      subLinks: [],
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
    if (pathname.startsWith("/scans")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (href === "/clients") {
    return (
      pathname === "/clients" ||
      pathname.startsWith("/clients/") ||
      pathname === "/agency/clients"
    );
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
  if (href === "/tools/go/dashboard" || href.endsWith("/overview")) {
    if (pathname === "/tools/go/dashboard") return true;
    if (businessId && pathname === `/businesses/${businessId}/overview`) {
      return true;
    }
    return false;
  }

  if (href === "/onboarding") {
    return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  }

  if (flags?.exact || href.endsWith("/review-requests") || href.endsWith("/tools/go/review-requests")) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

  if (href.includes("?tab=")) {
    const pathOnly = href.split("?")[0] ?? href;
    return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
