"use client";

import {
  dashboardCard,
  dashboardControl,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export const comparePageBg = "bg-[#F9FAFB]";

export const compareCardClass = cn(
  dashboardCard,
  "shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
);

export const compareHeaderBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50";

export const comparePrimaryBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-[#137752] px-3 py-1 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0f6344]";

export const compareSelectClass = cn(
  dashboardControl,
  "mt-0.5 h-auto w-full px-2.5 py-1.5"
);

export const compareFieldLabel = dashboardSectionLabel;
