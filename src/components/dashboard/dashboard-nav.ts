import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bot,
  ClipboardList,
  FileSearch,
  FileText,
  Grid3X3,
  KeyRound,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Settings2,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

export type SidebarNavChild = {
  href: string;
  label: string;
};

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isRankGrid?: boolean;
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

export function buildBusinessSidebarNav(businessId: string): {
  main: SidebarNavSection;
  reputation: SidebarReputationNav;
  research: SidebarNavSection;
  reports: SidebarNavSection;
} {
  const base = `/businesses/${businessId}`;

  return {
    main: {
      title: "Main",
      items: [
        { href: `${base}/overview`, label: "Dashboard", icon: LayoutDashboard },
        { href: `${base}/scans`, label: "Maps Scans", icon: Grid3X3, isRankGrid: true },
        { href: `${base}/growth-audit`, label: "Growth Audit", icon: FileSearch },
      ],
    },
    reputation: {
      title: "Reviews",
      items: [
        { href: `${base}/reviews`, label: "Review Feed", icon: Star },
        { href: `${base}/review-momentum`, label: "Review Momentum", icon: TrendingUp },
        {
          href: `${base}/review-requests`,
          label: "Review Requests",
          icon: MessageSquareText,
          children: [{ href: `${base}/review-campaigns`, label: "Campaigns" }],
        },
        { href: `${base}/contacts`, label: "Contacts", icon: Users },
        { href: `${base}/review-templates`, label: "Templates", icon: FileText },
        { href: `${base}/review-settings`, label: "Settings", icon: Settings2 },
      ],
      subLinks: [],
    },
    research: {
      title: "Research",
      items: [
        { href: `${base}/backlink-gap`, label: "Backlink Gap", icon: Link2 },
        { href: `${base}/trust`, label: "Local Trust", icon: Award },
        { href: `${base}/keywords`, label: "Keywords", icon: KeyRound },
        { href: `${base}/ai-visibility`, label: "AI Visibility", icon: Bot },
      ],
    },
    reports: {
      title: "Reports",
      items: [
        { href: `${base}/tasks`, label: "Growth Plan", icon: ClipboardList },
        { href: `${base}/reports`, label: "Reports", icon: FileText },
      ],
    },
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
  return pathname === href || pathname.startsWith(`${href}/`);
}
