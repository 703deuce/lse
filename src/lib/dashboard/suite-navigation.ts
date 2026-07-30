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
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import { toolHref, type LocationToolSlug } from "@/lib/dashboard/tool-modules";
import { isSidebarHrefActive } from "@/components/dashboard/dashboard-nav";

export type SuiteId = "local-seo" | "reviews" | "agency" | "settings";

export type SuiteNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  locked?: boolean;
  badge?: string;
  isRankGrid?: boolean;
  /** Render as sign-out control instead of a link */
  signOut?: boolean;
};

export type SuiteNavSection = {
  id: string;
  /** Visual group label (non-clickable). Omit or empty to hide heading. */
  label: string;
  items: SuiteNavLink[];
};

export type AppSuite = {
  id: SuiteId;
  label: string;
  icon: LucideIcon;
  agencyOnly?: boolean;
  sections: SuiteNavSection[];
};

export type SuiteNavOptions = {
  trial?: boolean;
  showAgencySuite?: boolean;
};

function loc(slug: LocationToolSlug, businessId?: string | null): string {
  return toolHref(slug, businessId);
}

function upgradeHref(feature: string) {
  return `/settings/subscription?upgrade=${encodeURIComponent(feature)}`;
}

function item(
  href: string,
  label: string,
  icon: LucideIcon,
  opts?: { locked?: boolean; badge?: string; isRankGrid?: boolean; signOut?: boolean }
): SuiteNavLink {
  return { href, label, icon, ...opts };
}

export function buildAppSuites(
  businessId?: string | null,
  options?: SuiteNavOptions
): AppSuite[] {
  const trial = Boolean(options?.trial);
  const showAgency = Boolean(options?.showAgencySuite);

  const businessSettingsHref = businessId ? `/businesses/${businessId}/settings` : "/settings";
  const requestHistoryHref = businessId
    ? `${loc("review-requests", businessId)}?tab=bulk`
    : "/tools/go/review-requests?tab=bulk";
  const messagingStatusHref = businessId
    ? `${loc("messaging", businessId)}/status`
    : "/tools/go/messaging/status";
  const messagingNumberHref = businessId
    ? `${loc("messaging", businessId)}/number`
    : "/tools/go/messaging/number";

  const lock = (feature: string, slug: LocationToolSlug, label: string, icon: LucideIcon) =>
    trial
      ? item(upgradeHref(feature), label, icon, { locked: true, badge: "Locked" })
      : item(loc(slug, businessId), label, icon);

  const lockHref = (feature: string, href: string, label: string, icon: LucideIcon) =>
    trial
      ? item(upgradeHref(feature), label, icon, { locked: true, badge: "Locked" })
      : item(href, label, icon);

  const suites: AppSuite[] = [
    {
      id: "local-seo",
      label: "Local SEO",
      icon: MapPin,
      sections: [
        {
          id: "overview",
          label: "",
          items: [item(loc("dashboard", businessId), "Overview", LayoutDashboard)],
        },
        {
          id: "map-rankings",
          label: "Map Rankings",
          items: [
            item(loc("maps-scans", businessId), "New Scan", Grid3X3, { isRankGrid: true }),
            lock("keywords", "maps-campaigns", "Maps Campaigns", FolderKanban),
            lock("keywords", "keywords", "Keywords", FolderKanban),
            item("/scans", "Recent Scans", History),
            item("/scans", "Scan History", History),
            item("/tools/google-maps-rank-checker", "Scan Maps", Grid3X3),
          ],
        },
        {
          id: "optimize",
          label: "Optimize",
          items: [
            lock("complete-audit", "growth-audit", "Google Business Profile Audit", FileSearch),
            lock("complete-audit", "growth-audit", "Complete Audit", ClipboardList),
            item(loc("local-seo-health", businessId), "Health Assessment", FileSearch),
            item(loc("tasks", businessId), "Growth Plan", ClipboardList),
          ],
        },
        {
          id: "grow-visibility",
          label: "Grow Visibility",
          items: [
            item(loc("review-competitors", businessId), "Competitors", Swords),
            item(loc("backlink-gap", businessId), "Backlink Opportunities", Link2),
            item(loc("trust", businessId), "Local Sponsorships", Award),
            item(loc("ai-visibility", businessId), "AI Visibility", Bot),
          ],
        },
        {
          id: "reporting",
          label: "Reporting",
          items: [item(loc("reports", businessId), "Reports", FileText)],
        },
      ],
    },
    {
      id: "reviews",
      label: "Reviews",
      icon: Star,
      sections: [
        {
          id: "overview",
          label: "",
          items: [item(loc("review-overview", businessId), "Reputation Overview", Sparkles)],
        },
        {
          id: "get-reviews",
          label: "Get Reviews",
          items: [
            item(loc("review-requests", businessId), "Send Request", Send),
            item(loc("review-requests", businessId), "Review Requests", MessageSquareText),
            lock("campaigns", "review-campaigns", "Campaigns", FolderKanban),
            item(loc("review-templates", businessId), "Templates", FileText),
            item(loc("integrations", businessId), "Automations", Webhook),
            item(loc("contacts", businessId), "Contacts", Users),
            item(loc("contacts", businessId), "Customers", Users),
            item(requestHistoryHref, "Request History", History),
          ],
        },
        {
          id: "track-reviews",
          label: "Track Reviews",
          items: [
            item(loc("reviews", businessId), "Reviews", Star),
            item(loc("review-analytics", businessId), "Review Velocity", TrendingUp),
            item(loc("review-competitors", businessId), "Competitors", Swords),
            item(loc("review-insights", businessId), "Insights", Sparkles),
            item(loc("reputation-audit", businessId), "Reputation Audit", FileSearch),
          ],
        },
        {
          id: "review-tools",
          label: "Review Tools",
          items: [
            item(loc("review-qr", businessId), "QR Campaigns", QrCode),
            item(loc("review-qr", businessId), "QR Code & Review Link", Link2),
            item("/tools/google-review-widget", "Review Widget", Star),
            item("/tools/review-response-generator", "Review Reply", MessageSquareText),
            item(loc("review-settings", businessId), "Review Sites", Settings2),
          ],
        },
        {
          id: "sms-email-setup",
          label: "SMS & Email Setup",
          items: [
            lockHref("messaging", messagingNumberHref, "Phone Number", Phone),
            lockHref("messaging", messagingStatusHref, "Registration", Phone),
            item(loc("review-alerts", businessId), "Alerts", Bell),
            item(loc("review-settings", businessId), "Reputation Settings", Settings2),
          ],
        },
        {
          id: "reports",
          label: "Reports",
          items: [item(loc("reports", businessId), "Reports", FileText)],
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      sections: [
        {
          id: "settings-links",
          label: "Settings",
          items: [
            item("/onboarding", "Get Started", MapPin),
            item("/settings", "Account", Settings),
            item(businessSettingsHref, "Business Profile", Building2),
            item("/settings/subscription", "Billing", CreditCard),
            item("/branding", "Branding", Palette),
            item("/settings", "Settings", Settings),
            item("#sign-out", "Sign Out", Settings, { signOut: true }),
          ],
        },
      ],
    },
  ];

  if (showAgency) {
    suites.splice(2, 0, {
      id: "agency",
      label: "Agency",
      icon: Building2,
      agencyOnly: true,
      sections: [
        {
          id: "workspace",
          label: "",
          items: [item("/workspace", "Workspace", Briefcase)],
        },
        {
          id: "prospects",
          label: "Prospects",
          items: [
            item("/prospects", "All Prospects", Users),
            item("/prospects/audits", "Prospect Audits", FileSearch),
          ],
        },
        {
          id: "clients",
          label: "Clients",
          items: [
            item("/clients", "Clients", Building2),
            item("/businesses", "Business Profiles", Building2),
          ],
        },
        {
          id: "agency-settings",
          label: "Agency Settings",
          items: [
            item("/branding", "Branding", Palette),
            item("/settings/subscription", "Billing", CreditCard),
          ],
        },
        {
          id: "reporting",
          label: "Reporting",
          items: [item(loc("reports", businessId), "Reports", FileText)],
        },
      ],
    });
  }

  return suites;
}

export function flattenSuiteLinks(suites: AppSuite[]): SuiteNavLink[] {
  const out: SuiteNavLink[] = [];
  for (const suite of suites) {
    for (const section of suite.sections) {
      out.push(...section.items.filter((l) => !l.signOut));
    }
  }
  return out;
}

export function resolveSuiteNavContext(
  pathname: string,
  suites: AppSuite[],
  businessId?: string | null
): { suiteId: SuiteId; sectionId: string } | null {
  for (const suite of suites) {
    for (const section of suite.sections) {
      for (const link of section.items) {
        if (link.signOut) continue;
        if (
          isSidebarHrefActive(pathname, link.href, businessId, {
            isRankGrid: link.isRankGrid,
          })
        ) {
          return { suiteId: suite.id, sectionId: section.id };
        }
      }
    }
  }

  if (
    pathname.includes("/messaging") ||
    pathname.includes("/automations") ||
    pathname.includes("/alerts")
  ) {
    const reviews = suites.find((s) => s.id === "reviews");
    if (reviews) {
      const sms = reviews.sections.find((s) => s.id === "sms-email-setup");
      if (sms && pathname.includes("/messaging")) {
        return { suiteId: "reviews", sectionId: sms.id };
      }
      const getReviews = reviews.sections.find((s) => s.id === "get-reviews");
      if (getReviews && pathname.includes("/automations")) {
        return { suiteId: "reviews", sectionId: getReviews.id };
      }
      if (sms && pathname.includes("/alerts")) {
        return { suiteId: "reviews", sectionId: sms.id };
      }
    }
  }

  if (
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/prospects") ||
    pathname.startsWith("/clients") ||
    pathname === "/businesses"
  ) {
    const agency = suites.find((s) => s.id === "agency");
    if (agency) {
      if (pathname.startsWith("/prospects")) return { suiteId: "agency", sectionId: "prospects" };
      if (pathname.startsWith("/clients")) return { suiteId: "agency", sectionId: "clients" };
      if (pathname === "/businesses" || pathname.startsWith("/businesses?")) {
        return { suiteId: "agency", sectionId: "clients" };
      }
      return { suiteId: "agency", sectionId: "workspace" };
    }
  }

  if (
    pathname.startsWith("/settings") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/branding")
  ) {
    return { suiteId: "settings", sectionId: "settings-links" };
  }

  if (businessId && pathname === `/businesses/${businessId}/settings`) {
    return { suiteId: "settings", sectionId: "settings-links" };
  }

  return null;
}
