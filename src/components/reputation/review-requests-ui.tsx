"use client";

import { Bell, BookOpen, Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import {
  ModuleHeader,
  TabBar,
  btnIcon,
  btnPrimary,
  btnSecondary,
  inputClass,
  fieldLabelClass,
} from "@/components/ui/design-system";
import { dashboardControl } from "@/components/overview/dashboard-ui";

export function ReviewRequestsPageHeader() {
  return (
    <ModuleHeader
      title="Review Requests"
      subtitle="Manage your review links, templates, sending, and tracking in one place."
      className="[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
    />
  );
}

export function ReviewRequestsTopBar() {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button type="button" className={cn(btnIcon, "h-9 w-9")} aria-label="Learn">
        <BookOpen className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={cn(btnIcon, "relative h-9 w-9")} aria-label="Notifications">
        <Bell className="h-3.5 w-3.5" />
        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
          8
        </span>
      </button>
      <button
        type="button"
        className={cn(
          dashboardControl,
          "inline-flex items-center gap-1.5 px-2.5 font-medium text-zinc-700"
        )}
      >
        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
        Last 30 days
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white sm:inline-flex">
        JD
      </span>
    </div>
  );
}

const SECTIONS: Array<{ id: ReviewRequestsSection; label: string }> = [
  { id: "poster", label: "Review Poster" },
  { id: "messages", label: "Templates" },
  { id: "send", label: "Quick Send" },
  { id: "bulk", label: "Bulk Upload" },
  { id: "tracking", label: "Tracking" },
];

export function ReviewRequestsSubTabsBar({
  active,
  onChange,
}: {
  active: ReviewRequestsSection;
  onChange: (section: ReviewRequestsSection) => void;
}) {
  return (
    <TabBar
      tabs={SECTIONS}
      active={active}
      onChange={onChange}
      className="[&_button]:pb-2.5 [&_button]:text-[13px] [&>div]:gap-4"
    />
  );
}

export function statusPill(status: string, hasReply?: boolean) {
  if (hasReply) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Replied
      </span>
    );
  }
  const styles: Record<string, { pill: string; dot: string }> = {
    sent: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100", dot: "bg-emerald-500" },
    failed: { pill: "bg-red-50 text-red-700 ring-1 ring-red-100", dot: "bg-red-500" },
    pending: { pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-100", dot: "bg-amber-500" },
    queued: { pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-100", dot: "bg-amber-500" },
  };
  const labels: Record<string, string> = {
    sent: "Sent",
    failed: "Failed",
    pending: "Pending",
    queued: "Queued",
  };
  const key = status in styles ? status : "pending";
  const s = styles[key];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {labels[key] ?? status}
    </span>
  );
}

export { inputClass as rrInputClass };
export { fieldLabelClass as rrLabelClass };
export { btnSecondary as rrOutlineBtn };
export { btnPrimary as rrPrimaryBtn };
