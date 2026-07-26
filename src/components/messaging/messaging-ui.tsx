"use client";

import Link from "next/link";
import { Check, Circle, XCircle } from "lucide-react";
import { RepBadge, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS, statusTone } from "@/lib/messaging/status";
import type { CustomerFacingStatus, MessagingProgressStep } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

export function MessagingStatusBadge({ status }: { status: CustomerFacingStatus }) {
  return <RepBadge tone={statusTone(status)}>{STATUS_LABELS[status]}</RepBadge>;
}

/** Horizontal numbered stepper matching the Text Messaging Setup mockups. */
export function MessagingProgressTracker({
  steps,
  currentId,
}: {
  steps: MessagingProgressStep[];
  currentId?: string;
}) {
  return (
    <div className={cn(rep.card, "px-4 py-5 sm:px-6")}>
      <ol className="flex items-start justify-between gap-1">
        {steps.map((step, index) => {
          const active = step.id === currentId;
          const done = step.status === "approved" || step.status === "ready";
          const failed =
            step.status === "failed" ||
            step.status === "action_required" ||
            step.status === "suspended";
          const inReview = step.status === "in_review" || step.status === "submitted";
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-0.5",
                    done ? "bg-[#137752]" : "bg-[#E4E7EC]"
                  )}
                />
              ) : null}
              <Link href={step.href} className="relative z-[1] flex flex-col items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white",
                    done
                      ? "bg-[#137752] text-white"
                      : active
                        ? "bg-[#137752] text-white"
                        : failed
                          ? "bg-[#D92D20] text-white"
                          : inReview
                            ? "bg-[#F79009] text-white"
                            : "bg-[#F2F4F7] text-[#667085]"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "max-w-[110px] text-xs font-semibold leading-snug",
                    active || done ? "text-[#101828]" : "text-[#667085]"
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    done || step.status === "ready"
                      ? "bg-[#ECFDF3] text-[#027A48]"
                      : failed
                        ? "bg-[#FEF3F2] text-[#B42318]"
                        : inReview
                          ? "bg-[#FFFAEB] text-[#B54708]"
                          : "bg-[#F2F4F7] text-[#667085]"
                  )}
                >
                  {STATUS_LABELS[step.status]}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MessagingPageShell({
  title,
  subtitle,
  actions,
  steps,
  currentId,
  children,
  hideProgress = false,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  steps: MessagingProgressStep[];
  currentId?: string;
  children: React.ReactNode;
  hideProgress?: boolean;
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
      {!hideProgress ? <MessagingProgressTracker steps={steps} currentId={currentId} /> : null}
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
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-5", className)}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[#101828]">{title}</h2>
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
