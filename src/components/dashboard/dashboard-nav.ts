import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  Bot,
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
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
  Phone,
  QrCode,
  Send,
  Settings,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import { toolHref, type LocationToolSlug } from "@/lib/dashboard/tool-modules";
import { isSmbLaunchNavEnabled } from "@/lib/product/smb-launch";

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

function buildAgencySidebarNav(businessId?: string | null): {
  getStarted: SidebarNavItem;
  work: SidebarNavSection;
  thisLocation: SidebarNavSection | null;
  growthTools: SidebarNavSection;
  reputation: SidebarReputationNav;
  textMessaging: SidebarNavSection;
  deliverables: SidebarNavSection;
  account: SidebarNavSection;
} {
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
    },
  ];

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
    thisLocation: null,
    growthTools: {
      title: "Growth Tools",
      items: [
        { href: loc("growth-audit", businessId), label: "Growth Audit", icon: FileSearch },
        { href: loc("backlink-gap", businessId), label: "Backlink Gap", icon: Link2 },
        { href: loc("trust", businessId), label: "Local Trust", icon: Award },
        { href: loc("ai-visibility", businessId), label: "AI Visibility", icon: Bot },
      ],
    },
    textMessaging: {
      title: "Text Messaging",
      items: [
        {
          href: loc("messaging", businessId),
          label: "Overview",
          icon: Phone,
        },
        {
          href: businessId
            ? `${loc("messaging", businessId)}/status`
            : "/tools/go/messaging/status",
          label: "Registration",
          icon: ShieldCheck,
        },
        {
          href: businessId
            ? `${loc("messaging", businessId)}/number`
            : "/tools/go/messaging/number",
          label: "Phone Number",
          icon: MessageSquareText,
        },
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
            { href: loc("review-qr", businessId), label: "QR Campaigns", icon: QrCode },
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

/**
 * One-business SMB launch nav — agency features stay in code but off this menu.
 */
function buildSmbSidebarNav(businessId?: string | null): ReturnType<typeof buildAgencySidebarNav> {
  const overviewHref = loc("dashboard", businessId);
  const sendHref = loc("review-requests", businessId);
  const historyHref = businessId
    ? `${loc("review-requests", businessId)}?tab=bulk`
    : "/tools/go/review-requests?tab=bulk";
  const messagingHref = businessId
    ? `${loc("messaging", businessId)}`
    : "/tools/go/messaging";
  const businessSettingsHref = businessId
    ? `/businesses/${businessId}/settings`
    : "/settings";

  const sendItem: SidebarNavItem = {
    href: sendHref,
    label: "Send Request",
    icon: Send,
  };

  const reviewItems: SidebarNavItem[] = [
    { href: loc("contacts", businessId), label: "Customers", icon: Users },
    { href: loc("review-campaigns", businessId), label: "Campaigns", icon: FolderKanban },
    { href: loc("review-qr", businessId), label: "QR Code & Review Link", icon: QrCode },
    { href: historyHref, label: "Request History", icon: History },
  ];

  return {
    getStarted: {
      href: "/onboarding",
      label: "Get started",
      icon: MapPin,
    },
    work: {
      title: "Overview",
      items: [
        {
          href: overviewHref,
          label: "Overview",
          icon: LayoutDashboard,
        },
      ],
    },
    thisLocation: null,
    reputation: {
      title: "Reviews",
      overview: sendItem,
      groups: [
        {
          title: "",
          items: reviewItems,
        },
      ],
      items: [sendItem, ...reviewItems],
      subLinks: [],
    },
    growthTools: {
      title: "Rank Tracking",
      items: [
        {
          href: loc("maps-scans", businessId),
          label: "New Scan",
          icon: Grid3X3,
          isRankGrid: true,
        },
        {
          href: "/scans",
          label: "Scan History",
          icon: History,
        },
        {
          href: loc("maps-campaigns", businessId),
          label: "Keywords",
          icon: FolderKanban,
        },
      ],
    },
    textMessaging: {
      title: "",
      items: [],
    },
    deliverables: {
      title: "Local SEO Audit",
      items: [
        {
          href: loc("local-seo-health", businessId),
          label: "Health Assessment",
          icon: FileSearch,
        },
        {
          href: loc("growth-audit", businessId),
          label: "Complete Audit",
          icon: ClipboardList,
        },
      ],
    },
    account: {
      title: "Settings",
      items: [
        {
          href: businessSettingsHref,
          label: "Business Profile",
          icon: Building2,
        },
        {
          href: messagingHref,
          label: "Messaging",
          icon: Phone,
        },
        {
          href: loc("review-settings", businessId),
          label: "Review Sites",
          icon: Settings2,
        },
        {
          href: "/settings/subscription",
          label: "Billing",
          icon: CreditCard,
        },
      ],
    },
  };
}

/**
 * One sidebar for the whole app.
 * SMB launch is default; set NEXT_PUBLIC_NAV_MODE=agency for the full consultant nav.
 */
export function buildUnifiedSidebarNav(businessId?: string | null): ReturnType<
  typeof buildAgencySidebarNav
> {
  if (isSmbLaunchNavEnabled()) {
    return buildSmbSidebarNav(businessId);
  }
  return buildAgencySidebarNav(businessId);
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
    if (pathname === "/prospects" || pathname.startsWith("/prospects?")) return true;
    if (/^\/prospects\/audits(?:\/|$|\?)/.test(pathname)) return false;
    if (/^\/prospects\/[^/]+\/audit(?:\/|$|\?)/.test(pathname)) return false;
    return /^\/prospects\/[^/]+\/?$/.test(pathname);
  }

  if (href === "/workspace" || href === "/dashboard") {
    return (
      pathname === "/workspace" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/workspace?")
    );
  }

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

  if (businessId && href === `/businesses/${businessId}/reputation/overview`) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

  if (businessId && href === `/businesses/${businessId}/reputation/messaging`) {
    return pathname === href || pathname.startsWith(`${href}?`);
  }
  if (href === "/tools/go/messaging") {
    return pathname === href || pathname.startsWith(`${href}?`);
  }

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
    href.endsWith("/reputation/qr-campaigns") ||
    href.endsWith("/tools/go/review-qr")
  ) {
    return (
      pathname === href ||
      pathname.startsWith(`${href}?`) ||
      pathname.startsWith(`${href}/`) ||
      pathname.includes("/reputation/qr-campaigns") ||
      pathname.endsWith("/reputation/qr")
    );
  }

  if (href.includes("?tab=")) {
    const pathOnly = href.split("?")[0] ?? href;
    const wantTab = new URL(href, "https://local.invalid").searchParams.get("tab");
    if (pathname === pathOnly || pathname.startsWith(`${pathOnly}?`) || pathname.startsWith(`${pathOnly}/`)) {
      if (!wantTab) return true;
      // Soft match: history tab highlights when on requests with that tab
      return pathname.includes(`tab=${wantTab}`) || pathname === pathOnly;
    }
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
