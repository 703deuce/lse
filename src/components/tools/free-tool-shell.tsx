"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function FreeToolShell({
  embed,
  title,
  subtitle,
  steps,
  children,
  ctaHref = "/sign-up",
  ctaLabel = "Get started free",
}: {
  embed?: boolean;
  title: string;
  subtitle: string;
  steps: { label: string; icon?: ReactNode }[];
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className={cn(embed ? "min-h-screen bg-[#F3F5F7] p-3 sm:p-5" : "min-h-screen bg-[#F3F5F7]")}>
      <div className={cn(!embed && "mx-auto max-w-5xl px-4 py-8 sm:py-10")}>
        {!embed ? (
          <div className="mb-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#137752]">Free tool</p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[#0B1220] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] text-[#667085]">{subtitle}</p>
          </div>
        ) : (
          <div className="mb-4">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[#0B1220]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
          </div>
        )}

        {steps.length > 0 ? (
          <ol className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li
                key={step.label}
                className="flex items-center gap-3 rounded-xl border border-[#E6EAF0] bg-white px-3 py-3 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[12px] font-extrabold text-[#137752]">
                  {i + 1}
                </span>
                <span className="text-[13px] font-semibold text-[#0B1220]">{step.label}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-sm sm:p-6">{children}</div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#137752] to-[#0B4F36] px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide">Unlock the full platform</p>
              <p className="mt-1 text-sm text-white/85">
                Save history, run full scans, and manage reviews in one place.
              </p>
            </div>
            <Link
              href={ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-extrabold text-[#137752] shadow"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FreeToolField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

export const freeToolInputClass =
  "h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm text-[#0B1220] outline-none transition focus:border-[#137752] focus:ring-2 focus:ring-[#137752]/15";

export const freeToolPrimaryBtnClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#137752] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(19,119,82,0.28)] hover:bg-[#0f6344] disabled:opacity-50";
