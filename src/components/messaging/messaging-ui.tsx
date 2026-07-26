"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check, Circle, PartyPopper, XCircle } from "lucide-react";
import { RepBadge, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS, registrationCompletionPercent, statusTone } from "@/lib/messaging/status";
import type {
  CustomerFacingStatus,
  MessagingProgressStep,
  MessagingRegistration,
  MessagingTimelineItem,
} from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

export function MessagingStatusBadge({ status }: { status: CustomerFacingStatus }) {
  return <RepBadge tone={statusTone(status)}>{STATUS_LABELS[status]}</RepBadge>;
}

export function MessagingCompletionBar({
  registration,
  className,
}: {
  registration: MessagingRegistration;
  className?: string;
}) {
  const pct = registrationCompletionPercent(registration);
  return (
    <div className={cn("mt-3 max-w-md", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="uppercase tracking-[0.08em] text-[#98A2B3]">Registration progress</span>
        <span className="text-[#137752]">{pct}% complete</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]">
        <div
          className="h-full rounded-full bg-[#137752] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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
    <div className={cn(rep.card, "messaging-enter px-4 py-5 sm:px-6")}>
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
          const available = step.available !== false;
          const circleClass = cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white transition-transform duration-200",
            done
              ? "bg-[#137752] text-white"
              : active
                ? "bg-[#137752] text-white"
                : failed
                  ? "bg-[#D92D20] text-white"
                  : inReview
                    ? "bg-[#F79009] text-white"
                    : "bg-[#F2F4F7] text-[#667085]",
            available && "group-hover:scale-105"
          );

          const content = (
            <>
              <span className={circleClass}>
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
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
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
            </>
          );

          return (
            <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-0.5 transition-colors duration-500",
                    done ? "bg-[#137752]" : "bg-[#E4E7EC]"
                  )}
                />
              ) : null}
              {available ? (
                <Link
                  href={step.href}
                  className="group relative z-[1] flex flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#137752]/40"
                  title={`Go to ${step.label}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  className="relative z-[1] flex cursor-not-allowed flex-col items-center gap-2 opacity-55"
                  title="Complete earlier steps to unlock"
                  aria-disabled
                >
                  {content}
                </div>
              )}
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
  registration,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  steps: MessagingProgressStep[];
  currentId?: string;
  children: React.ReactNode;
  hideProgress?: boolean;
  registration?: MessagingRegistration | null;
}) {
  return (
    <div className={cn(rep.page, "messaging-enter")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className={rep.title}>{title}</h1>
          <p className={rep.subtitle}>{subtitle}</p>
          {registration && !hideProgress ? (
            <MessagingCompletionBar registration={registration} />
          ) : null}
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
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <section className={cn(rep.card, "p-5 transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(16,24,40,0.06)]", className)}>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <h2 className="text-base font-semibold text-[#101828]">{title}</h2>
        </div>
        {subtitle ? <p className="mt-1 text-sm text-[#667085]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MessagingSuccessBanner({
  phoneNumber,
  className,
}: {
  phoneNumber?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "messaging-success overflow-hidden rounded-xl border border-[#A6F4C5] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_70%)] px-5 py-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#137752] text-white shadow-sm">
          <PartyPopper className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold text-[#027A48]">Congratulations</p>
          <p className="mt-1 text-sm leading-6 text-[#344054]">
            Your messaging registration has been approved
            {phoneNumber ? (
              <>
                {" "}
                and <span className="font-semibold text-[#101828]">{phoneNumber}</span> is active.
              </>
            ) : (
              "."
            )}{" "}
            You can now send review-request texts to customers.
          </p>
        </div>
      </div>
    </div>
  );
}

export function MessagingAlertBanner({
  tone = "warning",
  title,
  children,
}: {
  tone?: "warning" | "error" | "info" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    warning: "border-[#FEDF89] bg-[#FFFAEB] text-[#93370D]",
    error: "border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]",
    info: "border-[#B7E4CC] bg-[#ECFDF3] text-[#027A48]",
    success: "border-[#A6F4C5] bg-[#ECFDF3] text-[#027A48]",
  } as const;
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm messaging-enter", styles[tone])}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function MessagingLoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading text messaging setup">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[#E4E7EC]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[#F2F4F7]" />
        <div className="mt-2 h-2 w-72 max-w-full animate-pulse rounded-full bg-[#F2F4F7]" />
      </div>
      <div className="h-28 animate-pulse rounded-xl bg-[#F2F4F7]" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-[#F2F4F7]" />
        <div className="h-28 animate-pulse rounded-xl bg-[#F2F4F7]" />
        <div className="h-28 animate-pulse rounded-xl bg-[#F2F4F7]" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-[#F2F4F7]" />
    </div>
  );
}

export function RegistrationTimeline({ items }: { items: MessagingTimelineItem[] }) {
  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-7 bottom-0 w-0.5",
                  item.state === "complete" ? "bg-[#137752]" : "bg-[#E4E7EC]"
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                item.state === "complete"
                  ? "bg-[#137752] text-white"
                  : item.state === "current"
                    ? "bg-[#F79009] text-white"
                    : item.state === "failed"
                      ? "bg-[#D92D20] text-white"
                      : "bg-[#F2F4F7] text-[#98A2B3]"
              )}
            >
              {item.state === "complete" ? (
                <Check className="h-3.5 w-3.5" />
              ) : item.state === "failed" ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-[#101828]">{item.label}</p>
              <p className="mt-0.5 text-sm text-[#667085]">{item.detail}</p>
              {item.at ? (
                <p className="mt-1 text-xs text-[#98A2B3]">{new Date(item.at).toLocaleString()}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyDot() {
  return <Circle className="h-4 w-4 text-[#D0D5DD]" />;
}

export function FailedIcon() {
  return <XCircle className="h-4 w-4 text-[#B42318]" />;
}
