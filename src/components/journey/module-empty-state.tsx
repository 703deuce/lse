"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { EmptyState, btnPrimary, cardClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

/** Journey-aware empty state — purpose + one clear CTA + icon. */
export function ModuleEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}) {
  const action =
    actionHref != null ? (
      <Link href={actionHref} className={cn(btnPrimary, "mt-3 h-9 px-3 text-[13px]")}>
        {actionLabel}
      </Link>
    ) : onAction ? (
      <button
        type="button"
        onClick={onAction}
        className={cn(btnPrimary, "mt-3 h-9 px-3 text-[13px]")}
      >
        {actionLabel}
      </button>
    ) : null;

  return (
    <div className={cn(cardClass, "flex flex-col items-center px-4 py-10 text-center")}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
        <Icon className="h-5 w-5" />
      </span>
      <EmptyState title={title} description={description} action={action} className="border-0 bg-transparent p-0 shadow-none" />
    </div>
  );
}
