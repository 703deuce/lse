"use client";

import Link from "next/link";
import { Info, QrCode } from "lucide-react";
import {
  ReviewRequestsPanel,
  type ReviewRequestsPanelPreviewData,
} from "@/components/reputation/review-requests-panel";
import { rep } from "@/components/reputation/rep-ui";
import { ModulePage } from "@/components/ui/design-system";

/**
 * Dedicated QR / printable poster page — the existing Review Poster kit
 * (brand colors, company name, QR, downloadable poster) as its own surface.
 */
export function QrPosterPage({
  businessId,
  previewData,
}: {
  businessId: string;
  previewData?: ReviewRequestsPanelPreviewData;
}) {
  return (
    <ModulePage className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={`${rep.title} inline-flex items-center gap-2`}>
            QR Poster
            <Info className="h-4 w-4 text-[#98A2B3]" aria-hidden />
          </h1>
          <p className={rep.subtitle}>
            Create a printable review poster with your QR code, business name, and brand colors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/businesses/${businessId}/reputation/requests`}
            className={rep.btnSecondary}
          >
            Review Requests
          </Link>
          <Link
            href={`/businesses/${businessId}/reputation/settings`}
            className={rep.btnSecondary}
          >
            Reputation Settings
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">
        <QrCode className="h-4 w-4 shrink-0" />
        <p>
          Customize colors, headline, and QR code below, then download a print-ready poster for job
          sites, invoices, and front desks.
        </p>
      </div>

      <ReviewRequestsPanel businessId={businessId} section="poster" hideSubTabs previewData={previewData} />
    </ModulePage>
  );
}
