"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "info";

export interface ToastProps {
  open: boolean;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  onClose: () => void;
  className?: string;
}

const variantStyles: Record<ToastVariant, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-emerald-900/10 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-50",
  info: "border-zinc-200 bg-white text-zinc-900 shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
};

export function Toast({
  open,
  title,
  description,
  variant = "success",
  durationMs = 6000,
  onClose,
  className,
}: ToastProps) {
  useEffect(() => {
    if (!open || durationMs <= 0) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
        variantStyles[variant],
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
