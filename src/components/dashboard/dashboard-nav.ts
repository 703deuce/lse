import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FileText,
  FolderKanban,
  Grid3X3,
  KeyRound,
  LayoutDashboard,
  Palette,
  Settings,
  Users,
} from "lucide-react";
import { FREELANCER_MAPS_PRODUCT } from "@/lib/product/freelancer-maps";

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

/**
 * Freelancer Maps product — per-location sidebar.
 * Reputation / review-request tools stay out of the primary nav.
 */
export function buildBusinessSidebarNav(businessId: string): {
  main: SidebarNavSection;
  reputation: SidebarReputationNav;
  research: SidebarNavSection;
  reports: SidebarNavSection;
} {
  const base = `/businesses/${businessId}`;

  return {
    main: {
      title: "Work",
      items: [
        { href: `${base}/overview`, label: "Dashboard", icon: LayoutDashboard },
        { href: `${base}/scans`, label: "Scans", icon: Grid3X3, isRankGrid: true },
        { href: `${base}/reports`, label: "Reports", icon: FileText },
        { href: `${base}/ai-visibility`, label: "AI Visibility", icon: Bot },
      ],
    },
    // Empty when Maps product hides reputation — sidebar skips rendering when items empty.
    reputation: FREELANCER_MAPS_PRODUCT.hideReputationNav
      ? { title: "Reputation", items: [], subLinks: [] }
      : {
          title: "Reviews",
          items: [
            // Kept for optional re-enable; not shown while hideReputationNav is true.
          ],
          subLinks: [],
        },
    research: {
      title: "Setup",
      items: [
        { href: `${base}/campaigns`, label: "Campaigns", icon: FolderKanban },
        { href: `${base}/keywords`, label: "Keywords", icon: KeyRound },
        { href: `${base}/competitors`, label: "Competitors", icon: Users },
        { href: `${base}/settings`, label: "Location settings", icon: Settings },
      ],
    },
    reports: {
      title: "Branding",
      items: [
        {
          href: `/branding`,
          label: "Report branding",
          icon: Palette,
        },
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
  // Branding deep-link shares settings path — match settings prefix.
  if (href.includes("?tab=")) {
    const pathOnly = href.split("?")[0] ?? href;
    return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
