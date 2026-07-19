"use client";

import {
  dashboardBtnPrimary,
  dashboardBtnSecondary,
  dashboardCard,
  dashboardControl,
  dashboardPageBg,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export const comparePageBg = dashboardPageBg;

export const compareCardClass = dashboardCard;

export const compareHeaderBtn = dashboardBtnSecondary;

export const comparePrimaryBtn = dashboardBtnPrimary;

export const compareSelectClass = cn(
  dashboardControl,
  "mt-0.5 h-auto w-full px-2.5 py-1.5"
);

export const compareFieldLabel = dashboardSectionLabel;
