"use client";

import Link from "next/link";
import { EmptyState, btnPrimary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

/** Journey-aware empty state — purpose + one clear CTA. */
export function ModuleEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
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

  return <EmptyState title={title} description={description} action={action} />;
}
