"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Copy,
  FileText,
  History,
} from "lucide-react";
import { MessagingSetupCallout } from "@/components/messaging/messaging-setup-callout";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import type { CampaignRow } from "@/components/reputation/review-requests-campaigns";
import {
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { ModulePage } from "@/components/ui/design-system";
import type { PosterConfig } from "@/lib/reputation/poster-config";
import { cn } from "@/lib/utils";

type RequestTab = "send" | "bulk" | "qr" | "link";

type TemplateRow = {
  id: string;
  channel: string;
  name: string;
  subject?: string | null;
  body: string;
  is_default?: boolean;
  bestUsed?: string;
  avgConversion?: number;
  charCount?: number;
};

type ContactRow = {
  id: string;
  name: string;
  phone: string;
  lastService: string;
  tags: string[];
};

type KitData = {
  businessName: string;
  placeId: string | null;
  sendFromNumber?: string;
  sendFromVerified?: boolean;
  eligibleCount?: number;
  selectedContacts?: ContactRow[];
  link: {
    id: string;
    review_url: string;
    short_url?: string | null;
    place_id?: string;
    poster_config?: PosterConfig;
  } | null;
  posterConfig: PosterConfig;
  mapsFallbackUrl: string | null;
  warning: string | null;
  templates: TemplateRow[];
  events: Array<{ id: string; event_type: string; channel?: string | null; created_at: string }>;
  keywordSuggestions: Array<{ id?: string; keyword: string; keyword_type?: string; gap?: number }>;
};

type SendRow = {
  id: string;
  channel: string;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  status: string;
  message_body: string;
  sent_at?: string | null;
  created_at: string;
  has_reply?: boolean;
  review_request_contacts?: { customer_name?: string | null } | null;
};

type Stats = {
  total_sent: number;
  total_sent_trend?: number;
  email_sent: number;
  sms_sent: number;
  manual_sent: number;
  failed: number;
  delivery_rate?: number;
  delivery_rate_trend?: number;
  last_7_days: number;
  last_7_days_trend?: number;
  last_30_days: number;
  replies?: number;
  reviews_generated?: number;
  reviews_generated_trend?: number;
  review_link_clicks?: number;
  review_link_clicks_trend?: number;
  conversion_rate?: number;
  conversion_rate_trend?: number;
  recent_sends: SendRow[];
  trial_sms_template?: string | null;
};

export type ReviewRequestsDashboardPreviewData = {
  kit: KitData;
  stats?: Stats | null;
  campaigns?: CampaignRow[];
};

const TABS: Array<{ id: RequestTab; label: string }> = [
  { id: "send", label: "One-Time Send" },
  { id: "bulk", label: "Bulk Send" },
  { id: "qr", label: "QR Code" },
  { id: "link", label: "Link & Share" },
];

function parseTab(value: string | null): RequestTab {
  if (value === "bulk") return "bulk";
  if (value === "poster" || value === "qr") return "qr";
  if (value === "messages" || value === "templates" || value === "link") return "link";
  return "send";
}

function panelSectionForTab(tab: RequestTab): ReviewRequestsSection {
  if (tab === "bulk") return "bulk";
  if (tab === "link") return "poster";
  if (tab === "qr") return "poster";
  return "send";
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function LinkSharePanel({
  data,
  businessId,
  previewData,
}: {
  data: KitData | null;
  businessId: string;
  previewData?: ReviewRequestsDashboardPreviewData;
}) {
  const reviewUrl = data?.link?.review_url ?? null;
  const shortUrl = data?.link?.short_url ? `reviews.mapsgrowth.app/${data.link.short_url}` : null;

  return (
    <div className="space-y-4">
      <div className={cn(rep.card, "p-4")}>
        <h2 className="text-[15px] font-semibold text-[#101828]">Shareable Review Link</h2>
        <p className="mt-1 text-sm text-[#667085]">Copy this link into invoices, follow-up emails, or team scripts.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input readOnly value={shortUrl ?? reviewUrl ?? "Generate a review link first"} className={cn(rep.input, "min-w-[260px] flex-1")} />
          <button
            type="button"
            className={rep.btnPrimary}
            onClick={() => {
              if (reviewUrl) void navigator.clipboard.writeText(reviewUrl);
            }}
          >
            <Copy className="h-4 w-4" />
            Copy Link
          </button>
        </div>
      </div>
      <ReviewRequestsPanel businessId={businessId} section="messages" hideSubTabs previewData={previewData} />
    </div>
  );
}

export function ReviewRequestsDashboard({
  businessId,
  previewData,
}: {
  businessId: string;
  previewData?: ReviewRequestsDashboardPreviewData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<RequestTab>(() => parseTab(searchParams.get("tab")));
  const [data, setData] = useState<KitData | null>(previewData?.kit ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setTab(parseTab(searchParams.get("tab"))));
  }, [searchParams]);

  const load = useCallback(async () => {
    if (previewData) return;
    setError(null);
    try {
      const kitRes = await fetch(`/api/reputation/review-link/${businessId}`);
      const kitJson = await kitRes.json().catch(() => ({}));
      if (!kitRes.ok) throw new Error(kitJson.error ?? "Failed to load review link");
      setData(kitJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review requests");
      setData(null);
    }
  }, [businessId, previewData]);

  useEffect(() => {
    if (previewData) return;
    queueMicrotask(() => void load());
  }, [load, previewData]);

  const handleTabChange = useCallback(
    (next: string) => {
      const nextTab = next as RequestTab;
      setTab(nextTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", nextTab);
      router.replace(`/businesses/${businessId}/reputation/requests?${params.toString()}`, {
        scroll: false,
      });
    },
    [businessId, router, searchParams]
  );

  return (
    <ModulePage className={rep.page}>
      <RepPageHeader
        title="Review Requests"
        subtitle="Send review requests to your customers and track results."
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button
              type="button"
              className={rep.btnSecondary}
              onClick={() => handleTabChange("send")}
              title="Use the one-time send wizard below"
            >
              How it works
            </button>
            <Link
              href={`/businesses/${businessId}/reputation/templates`}
              className={rep.btnSecondary}
            >
              <FileText className="h-4 w-4" />
              Templates
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>
          </>
        }
        primaryAction={
          <Link
            href={`/businesses/${businessId}/reputation/requests?tab=bulk`}
            className={rep.btnPrimary}
            onClick={(e) => {
              // Prefer in-page tracking when already on Review Requests.
              if (tab !== "bulk") return;
              e.preventDefault();
              handleTabChange("bulk");
            }}
          >
            <History className="h-4 w-4" />
            Bulk &amp; History
          </Link>
        }
      />

      <MessagingSetupCallout businessId={businessId} />

      <RepTabs tabs={TABS} active={tab} onChange={handleTabChange} />

      {error ? (
        <div className="rounded-xl border border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{error}</div>
      ) : null}

      {tab === "send" ? (
        <ReviewRequestsPanel
          businessId={businessId}
          section="send"
          hideSubTabs
          previewData={previewData}
        />
      ) : null}

      {tab === "bulk" ? (
        <ReviewRequestsPanel
          businessId={businessId}
          section={panelSectionForTab(tab)}
          hideSubTabs
          previewData={previewData}
        />
      ) : null}

      {tab === "qr" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3">
            <p className="text-sm text-[#027A48]">
              The printable QR poster lives on its own page so you can customize colors, headline, and
              downloads without mixing it into one-time sends.
            </p>
            <Link
              href={`/businesses/${businessId}/reputation/qr`}
              className={rep.btnPrimary}
            >
              Open QR Poster
            </Link>
          </div>
          <ReviewRequestsPanel businessId={businessId} section="poster" hideSubTabs previewData={previewData} />
        </div>
      ) : null}

      {tab === "link" ? (
        <LinkSharePanel businessId={businessId} data={data} previewData={previewData} />
      ) : null}
    </ModulePage>
  );
}
