"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Phone } from "lucide-react";
import { isMessagingReady, STATUS_LABELS } from "@/lib/messaging/status";
import type { MessagingRegistration } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

/**
 * Surfaces Text Messaging setup wherever customers already work on SMS
 * review requests — so they do not have to hunt for a buried nav item.
 */
export function MessagingSetupCallout({
  businessId,
  className,
  compact = false,
}: {
  businessId: string;
  className?: string;
  compact?: boolean;
}) {
  const [registration, setRegistration] = useState<MessagingRegistration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/messaging/registration?businessId=${businessId}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json.registration) {
          setRegistration(json.registration as MessagingRegistration);
        }
      } catch {
        // Keep silent — callout still shows a default CTA below.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!loaded) return null;

  const href = `/businesses/${businessId}/reputation/messaging`;
  const ready = registration ? isMessagingReady(registration) : false;

  if (ready && registration) {
    if (compact) return null;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#137752] shadow-sm">
            <Phone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#027A48]">Text messaging is active</p>
            <p className="mt-0.5 text-sm text-[#344054]">
              Sending from {registration.phoneNumberFriendly ?? "your dedicated number"}.
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#A6F4C5] bg-white px-3 text-sm font-semibold text-[#137752] transition hover:bg-[#F6FEF9]"
        >
          Open Text Messaging
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const started = Boolean(registration && registration.overallStatus !== "not_started");
  const cta = started ? "Continue setup" : "Set up Text Messaging";
  const statusLabel = registration ? STATUS_LABELS[registration.overallStatus] : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B7E4CC] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_65%)] px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#137752] text-white">
          <Phone className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#101828]">
            {started ? "Finish Text Messaging setup" : "Enable Text Messaging for SMS review requests"}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#486581]">
            {started && statusLabel
              ? `Registration status: ${statusLabel}. Complete A2P approval and pick a local number before outbound SMS can send.`
              : "Register once for A2P compliance, get a dedicated business number, then send review-request texts from Review Requests."}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#137752] px-4 text-sm font-semibold text-white transition hover:bg-[#0f6244]"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
