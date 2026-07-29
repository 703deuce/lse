"use client";

import Link from "next/link";
import { Star, Wallet } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import { cn } from "@/lib/utils";

export function QrCampaignTypeSelector({ businessId }: { businessId: string }) {
  const base = `/businesses/${businessId}/reputation/qr-campaigns`;

  return (
    <ModulePage className="space-y-8">
      <div>
        <Link
          href={base}
          className="text-sm font-medium text-[#64748B] hover:text-[#0B1B32]"
        >
          ← Back to QR campaigns
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold text-[#0B1B32]">Create QR campaign</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Choose the type of QR campaign you want to create.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href={`${base}/new/review`}
          className={cn(
            qrUi.card,
            "group block p-6 transition hover:border-[#16A34A] hover:shadow-lg"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DCFCE7] text-[#16A34A]">
            <Star className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#0B1B32]">Google Review QR</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Collect Google reviews with a tracked QR code and printable poster. Customers scan
            and leave a review on Google.
          </p>
          <span className="mt-4 inline-flex text-sm font-semibold text-[#16A34A] group-hover:underline">
            Select →
          </span>
        </Link>

        <Link
          href={`${base}/new/payment`}
          className={cn(
            qrUi.card,
            "group block border-2 border-[#2563EB] p-6 shadow-md transition hover:shadow-lg"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#2563EB]">
            <Wallet className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-[#0B1B32]">Pay &amp; Review QR</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            One hosted page for payment links, Google and Facebook reviews, and social connections.
            Money goes directly to your accounts — we track clicks, not payments.
          </p>
          <span className="mt-4 inline-flex text-sm font-semibold text-[#2563EB] group-hover:underline">
            Select →
          </span>
        </Link>
      </div>
    </ModulePage>
  );
}
