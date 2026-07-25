"use client";

import Link from "next/link";
import { Check, Circle, Clock3, AlertTriangle, XCircle } from "lucide-react";
import { RepBadge, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS, statusTone } from "@/lib/messaging/status";
import type { CustomerFacingStatus, MessagingProgressStep } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

export function MessagingStatusBadge({ status }: { status: CustomerFacingStatus }) {
  return <RepBadge tone={statusTone(status)}>{STATUS_LABELS[status]}</RepBadge>;
}

export function MessagingProgressTracker({
  steps,
  currentId,
}: {
  steps: MessagingProgressStep[];
  currentId?: string;
}) {
  return (
    <ol className="grid gap-2 md:grid-cols-6">
      {steps.map((step, index) => {
        const active = step.id === currentId;
        const done = step.status === "approved" || step.status === "ready";
        const failed =
          step.status === "failed" ||
          step.status === "action_required" ||
          step.status === "suspended";
        const inReview = step.status === "in_review" || step.status === "submitted";
        return (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "flex h-full flex-col gap-2 rounded-xl border px-3 py-3 transition",
                active
                  ? "border-[#137752] bg-[#ECFDF3]"
                  : "border-[#E6EAF0] bg-white hover:border-[#B7E4CC]"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    done
                      ? "bg-[#137752] text-white"
                      : failed
                        ? "bg-[#FEF3F2] text-[#B42318]"
                        : inReview
                          ? "bg-[#FFFAEB] text-[#B54708]"
                          : "bg-[#F2F4F7] text-[#667085]"
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : failed ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : inReview ? (
                    <Clock3 className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                  Step {index + 1}
                </span>
              </div>
              <p className="text-sm font-semibold text-[#101828]">{step.label}</p>
              <MessagingStatusBadge status={step.status} />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function MessagingPageShell({
  title,
  subtitle,
  actions,
  steps,
  currentId,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  steps: MessagingProgressStep[];
  currentId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className={rep.title}>{title}</h1>
          <p className={rep.subtitle}>{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <MessagingProgressTracker steps={steps} currentId={currentId} />
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[#344054]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[#98A2B3]">{hint}</span> : null}
    </label>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(rep.card, "p-4")}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[#101828]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[#667085]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyDot() {
  return <Circle className="h-4 w-4 text-[#D0D5DD]" />;
}

export function FailedIcon() {
  return <XCircle className="h-4 w-4 text-[#B42318]" />;
}
