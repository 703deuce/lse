"use client";

import Link from "next/link";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { RunScanButton } from "@/components/scan/run-scan-button";
import { OverviewBusinessMeta } from "@/components/overview/overview-business-meta";
import { ModuleHeader, btnPrimary, btnSecondary } from "@/components/ui/design-system";

export function OverviewPageHeader({
  businessId,
  name,
  address,
  primaryCategory,
}: {
  businessId: string;
  name: string;
  address: string | null;
  primaryCategory: string | null;
}) {
  return (
    <ModuleHeader
      title={name}
      icon={BadgeCheck}
      meta={
        <OverviewBusinessMeta
          address={address}
          primaryCategory={primaryCategory}
          businessId={businessId}
        />
      }
      actions={
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href={`/businesses/${businessId}/growth-audit`} className={btnSecondary}>
              Growth Audit
            </Link>
            <Link href={`/businesses/${businessId}/workspace`} className={btnPrimary}>
              Open Maps Workspace
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
          <RunScanButton businessId={businessId} variant="overview" />
        </div>
      }
    />
  );
}
