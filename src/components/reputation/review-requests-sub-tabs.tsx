"use client";

import { cn } from "@/lib/utils";

export type ReviewRequestsSection = "poster" | "messages" | "send" | "bulk" | "tracking";

const SECTIONS: Array<{ id: ReviewRequestsSection; label: string }> = [
  { id: "poster", label: "Review Poster" },
  { id: "messages", label: "Templates" },
  { id: "send", label: "Quick Send" },
  { id: "bulk", label: "Bulk Upload" },
  { id: "tracking", label: "Tracking" },
];

export function ReviewRequestsSubTabs({
  active,
  onChange,
}: {
  active: ReviewRequestsSection;
  onChange: (section: ReviewRequestsSection) => void;
}) {
  return (
    <div className="-mb-px flex flex-wrap gap-4 border-b border-border">
      {SECTIONS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
            active === tab.id
              ? "border-primary text-emerald-700"
              : "border-transparent text-text-muted hover:border-border hover:text-text"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
