import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bot,
  ClipboardList,
  FileSearch,
  FileText,
  FolderKanban,
  Grid3X3,
  KeyRound,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Settings2,
  Star,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";

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
  /** Nested links indented under this item (e.g. Campaigns under Review Requests). */
  children?: SidebarNavChild[];
};

export type SidebarNavSection = {
  title: string;
  items: SidebarNavItem[];
};

export type SidebarReputationNav = {
  title: string;
  items: SidebarNavItem[];
  /** @deprecated Prefer item.children for nesting under a parent. */
  subLinks: SidebarNavChild[];
};

/**
 * Per-location sidebar grouped for the freelancer journey:
 * WORK → GROWTH TOOLS → REPUTATION → DELIVERABLES
 * All tools stay visible; grouping answers “what is this for?”
 */
export function buildBusinessSidebarNav(businessId: string): {
  work: SidebarNavSection;
  growthTools: SidebarNavSection;
  reputation: SidebarReputationNav;
  deliverables: SidebarNavSection;
  /** @deprecated aliases for older sidebar renderers */
  main: SidebarNavSection;
  research: SidebarNavSection;
  reports: SidebarNavSection;
} {
  const base = `/businesses/${businessId}`;

  const work: SidebarNavSection = {
    title: "Work",
    items: [
      { href: `${base}/overview`, label: "Dashboard", icon: LayoutDashboard },
      { href: `${base}/scans`, label: "Maps Scans", icon: Grid3X3, isRankGrid: true },
      { href: `${base}/campaigns`, label: "Maps Campaigns", icon: FolderKanban },
    ],
  };

  const growthTools: SidebarNavSection = {
    title: "Growth Tools",
    items: [
      { href: `${base}/growth-audit`, label: "Growth Audit", icon: FileSearch },
      { href: `${base}/backlink-gap`, label: "Backlink Gap", icon: Link2 },
      { href: `${base}/trust`, label: "Local Trust", icon: Award },
      { href: `${base}/keywords`, label: "Keywords", icon: KeyRound },
      { href: `${base}/ai-visibility`, label: "AI Visibility", icon: Bot },
    ],
  };

  const reputation: SidebarReputationNav = {
    title: "Reputation",
    items: [
      { href: `${base}/reviews`, label: "Review Feed", icon: Star },
      { href: `${base}/review-momentum`, label: "Review Momentum", icon: TrendingUp },
      {
        href: `${base}/review-requests`,
        label: "Review Requests",
        icon: MessageSquareText,
        badge: "Add-on",
        children: [{ href: `${base}/review-campaigns`, label: "Campaigns", badge: "Upgrade" }],
      },
      { href: `${base}/contacts`, label: "Contacts", icon: Users },
      { href: `${base}/review-templates`, label: "Templates", icon: FileText },
      { href: `${base}/integrations`, label: "Review Triggers", icon: Webhook },
      { href: `${base}/review-settings`, label: "Settings", icon: Settings2 },
    ],
    subLinks: [],
  };

  const deliverables: SidebarNavSection = {
    title: "Deliverables",
    items: [
      { href: `${base}/reports`, label: "Reports", icon: FileText },
      { href: `${base}/tasks`, label: "Growth Plan", icon: ClipboardList },
    ],
  };

  return {
    work,
    growthTools,
    reputation,
    deliverables,
    main: work,
    research: growthTools,
    reports: deliverables,
  };
}

export function isSidebarHrefActive(
  pathname: string,
  href: string,
  businessId: string,
  flags?: { isRankGrid?: boolean; exact?: boolean }
): boolean {
  if (flags?.isRankGrid) {
    return pathname.includes(`/businesses/${businessId}/grid/`) || pathname === href;
  }
  // Review Requests parent should not stay active on nested Campaigns.
  if (flags?.exact || href.endsWith("/review-requests")) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }
  // Branding deep-link shares settings path — match settings prefix.
  if (href.includes("?tab=")) {
    const pathOnly = href.split("?")[0] ?? href;
    return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
