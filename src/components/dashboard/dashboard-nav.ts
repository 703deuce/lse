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
  Star,
  TrendingUp,
} from "lucide-react";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isRankGrid?: boolean;
};

export type SidebarNavSection = {
  title: string;
  items: SidebarNavItem[];
};

export type SidebarReputationNav = {
  title: string;
  items: SidebarNavItem[];
  subLinks: Array<{ href: string; label: string }>;
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
        { href: `${base}/review-momentum`, label: "Review Momentum™", icon: TrendingUp },
      ],
    },
    reputation: {
      title: "Reputation",
      items: [{ href: `${base}/reviews`, label: "Reviews", icon: Star }],
      subLinks: [{ href: `${base}/review-requests`, label: "Review Requests" }],
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
  flags?: { isRankGrid?: boolean }
): boolean {
  if (flags?.isRankGrid) {
    return pathname.includes(`/businesses/${businessId}/grid/`) || pathname === href;
  }
  if (href.includes("/review-requests")) {
    return pathname.includes(`/businesses/${businessId}/review-requests`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
