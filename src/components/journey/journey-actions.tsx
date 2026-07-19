"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FilePlus2, ListPlus, Radar } from "lucide-react";
import {
  reportsHrefForStaging,
  stageReportItem,
  type StagedReportItem,
} from "@/lib/journey/report-staging";
import { btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const btnSm = cn(btnSecondary, "h-8 gap-1.5 px-2.5 text-[12px]");

export function AddToReportButton({
  businessId,
  source,
  title,
  href,
  meta,
  reportType = "monthly",
  className,
}: {
  businessId: string;
  source: StagedReportItem["source"];
  title: string;
  href?: string;
  meta?: StagedReportItem["meta"];
  reportType?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className={cn(btnSm, className)}
      onClick={() => {
        stageReportItem({ businessId, source, title, href, meta });
        setDone(true);
        window.setTimeout(() => setDone(false), 2000);
      }}
      title="Stage this for the next client report"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <FilePlus2 className="h-3.5 w-3.5" />}
      {done ? "Staged" : "Add to report"}
    </button>
  );
}

export function OpenReportWithStagingLink({
  businessId,
  source,
  title,
  href,
  meta,
  reportType = "monthly",
  label = "Add to report",
  className,
}: {
  businessId: string;
  source: StagedReportItem["source"];
  title: string;
  href?: string;
  meta?: StagedReportItem["meta"];
  reportType?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={reportsHrefForStaging(businessId, { type: reportType, source })}
      className={cn(btnSm, className)}
      onClick={() => {
        stageReportItem({ businessId, source, title, href, meta });
      }}
    >
      <FilePlus2 className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

export function CreateTaskButton({
  label = "Create task",
  busy,
  onClick,
  className,
}: {
  label?: string;
  busy?: boolean;
  onClick: () => void | Promise<void>;
  className?: string;
}) {
  const [localBusy, setLocalBusy] = useState(false);
  const isBusy = busy || localBusy;
  return (
    <button
      type="button"
      disabled={isBusy}
      className={cn(btnSm, className)}
      onClick={() => {
        setLocalBusy(true);
        void Promise.resolve(onClick()).finally(() => setLocalBusy(false));
      }}
    >
      <ListPlus className="h-3.5 w-3.5" />
      {isBusy ? "Creating…" : label}
    </button>
  );
}

export function JourneyNextActionsStrip({
  businessId,
  title = "What next?",
  actions,
}: {
  businessId: string;
  title?: string;
  actions: Array<{
    id: string;
    label: string;
    href?: string;
    onClick?: () => void;
    primary?: boolean;
  }>;
}) {
  if (!actions.length) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-emerald-900">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) =>
            a.href ? (
              <Link
                key={a.id}
                href={a.href}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium",
                  a.primary
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
                )}
              >
                {a.label}
              </Link>
            ) : (
              <button
                key={a.id}
                type="button"
                onClick={a.onClick}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium",
                  a.primary
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"
                )}
              >
                {a.label}
              </button>
            )
          )}
          <Link
            href={`/businesses/${businessId}/scans/new`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-[12px] font-medium text-emerald-900 hover:bg-emerald-50"
          >
            <Radar className="h-3.5 w-3.5" />
            Run another
          </Link>
        </div>
      </div>
    </div>
  );
}
