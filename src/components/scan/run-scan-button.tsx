"use client";

import Link from "next/link";
import { Play } from "lucide-react";

export function RunScanButton({
  businessId,
  variant = "default",
}: {
  businessId: string;
  gridSize?: number;
  radiusMeters?: number;
  showSettingsLink?: boolean;
  variant?: "default" | "overview";
}) {
  const isOverview = variant === "overview";

  return (
    <Link
      href={`/businesses/${businessId}/scans`}
      className={
        isOverview
          ? "inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          : "inline-flex items-center gap-2 rounded-lg bg-[#137752] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f6244]"
      }
    >
      <Play className="h-4 w-4" />
      New scan
    </Link>
  );
}
