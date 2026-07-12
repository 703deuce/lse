"use client";

import { Bell, BookOpen, Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import {
  ModuleHeader,
  TabBar,
  btnPrimary,
  btnSecondary,
  inputClass,
  fieldLabelClass,
} from "@/components/ui/design-system";

export function ReviewRequestsPageHeader() {
  return (
    <ModuleHeader
      title="Review Requests"
      subtitle="Manage your review links, templates, sending, and tracking in one place."
    />
  );
}

export function ReviewRequestsTopBar() {
  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn}>
        <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
        Learn
      </button>
      <button type="button" className={`relative ${btn}`} aria-label="Notifications">
        <Bell className="h-3.5 w-3.5 text-zinc-500" />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          8
        </span>
      </button>
      <button type="button" className={btn}>
        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
        Last 30 days
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>
      <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white sm:inline-flex">
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
  return <TabBar tabs={SECTIONS} active={active} onChange={onChange} />;
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
