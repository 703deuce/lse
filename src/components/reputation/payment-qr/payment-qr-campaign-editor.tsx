"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { QrKpiCard, QrStatusBadge, qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import {
  PAYMENT_MODE_LABELS,
  type PaymentMode,
  type PaymentPageConfiguration,
} from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

type CreatedRequest = {
  publicPageUrl: string;
  shortCode: string;
  amountCents: number;
  note: string | null;
  qrDataUrl: string;
};

export function PaymentQrCampaignEditor({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const base = `/businesses/${businessId}/reputation/qr-campaigns`;
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<ReviewQrCampaign | null>(null);
  const [config, setConfig] = useState<PaymentPageConfiguration | null>(null);
  const [trackedUrl, setTrackedUrl] = useState("");
  const [publicPageUrl, setPublicPageUrl] = useState("");
  const [permanentPageUrl, setPermanentPageUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<CreatedRequest | null>(null);
  const [requestCopied, setRequestCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignRes, configRes] = await Promise.all([
        fetch(`/api/reputation/qr-campaigns/${campaignId}?businessId=${businessId}`),
        fetch(
          `/api/reputation/payment-qr?businessId=${businessId}&campaignId=${campaignId}`
        ),
      ]);
      const campaignJson = (await campaignRes.json()) as {
        campaign?: ReviewQrCampaign;
        trackedUrl?: string;
      };
      const configJson = (await configRes.json()) as {
        config?: PaymentPageConfiguration;
        publicPageUrl?: string;
        permanentPageUrl?: string | null;
        error?: string;
      };

      if (campaignJson.campaign) {
        setCampaign(campaignJson.campaign);
        setTrackedUrl(campaignJson.trackedUrl ?? "");
        const pageUrl =
          configJson.publicPageUrl ??
          `https://app.localseoexpress.com/pay/${campaignJson.campaign.publicSlug ?? campaignJson.campaign.shortCode}`;
        setPublicPageUrl(pageUrl);
        setPermanentPageUrl(configJson.permanentPageUrl ?? null);
        const qr = await QRCode.toDataURL(
          campaignJson.trackedUrl ??
            `https://app.localseoexpress.com/r/${campaignJson.campaign.shortCode}`,
          { width: 400, margin: 1, color: { dark: "#0B1B32", light: "#ffffff" } }
        );
        setQrDataUrl(qr);
      }
      if (configJson.config) setConfig(configJson.config);
    } finally {
      setLoading(false);
    }
  }, [businessId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus() {
    if (!campaign) return;
    setBusy(true);
    try {
      const next = campaign.status === "active" ? "paused" : "active";
      await fetch(`/api/reputation/qr-campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, patch: { status: next } }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createPaymentRequest() {
    const parsed = parseFloat(requestAmount);
    if (!parsed || parsed <= 0) {
      setRequestError("Enter a valid amount greater than zero.");
      return;
    }
    setCreatingRequest(true);
    setRequestError(null);
    try {
      const amountCents = Math.round(parsed * 100);
      const res = await fetch("/api/reputation/payment-qr/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          qrCampaignId: campaignId,
          amountCents,
          note: requestNote.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        publicPageUrl?: string;
        session?: { shortCode?: string; amountCents?: number; note?: string | null };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not create payment request");

      const pageUrl = json.publicPageUrl ?? "";
      const qr = await QRCode.toDataURL(pageUrl, {
        width: 280,
        margin: 1,
        color: { dark: "#0B1B32", light: "#ffffff" },
      });
      setCreatedRequest({
        publicPageUrl: pageUrl,
        shortCode: json.session?.shortCode ?? "",
        amountCents: json.session?.amountCents ?? amountCents,
        note: json.session?.note ?? (requestNote.trim() || null),
        qrDataUrl: qr,
      });
      setRequestAmount("");
      setRequestNote("");
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Could not create payment request");
    } finally {
      setCreatingRequest(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-red-600">Campaign not found.</p>;
  }

  const paymentMode: PaymentMode = config?.paymentMode ?? "reusable_page";
  const showPermanentPage = paymentMode === "reusable_page" && campaign.publicSlug;

  return (
    <ModulePage className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={base} className="text-sm font-medium text-[#64748B] hover:text-[#0B1B32]">
            ← All campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className={qrUi.title}>{campaign.name}</h1>
            <QrStatusBadge status={campaign.status} />
            <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-bold text-[#1D4ED8]">
              Payment QR
            </span>
            <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-semibold text-[#64748B]">
              {PAYMENT_MODE_LABELS[paymentMode]}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/${campaignId}/analytics`}
            className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
          >
            <BarChart3 className="h-4 w-4" /> Analytics
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleStatus()}
            className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
          >
            {campaign.status === "active" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {campaign.status === "active" ? "Pause" : "Activate"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <QrKpiCard label="QR scans" value={String(campaign.totalScans)} />
        <QrKpiCard label="Est. unique" value={String(campaign.estimatedUniqueScans)} />
        <QrKpiCard label="Short code" value={campaign.shortCode} />
      </div>

      <div className={cn(qrUi.cardPad, "space-y-4")}>
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-[#2563EB]" />
          <h2 className="text-sm font-bold text-[#0B1B32]">Create payment request</h2>
        </div>
        <p className="text-sm text-[#64748B]">
          Set an amount and optional note to generate a one-time link and QR. The QR points to your
          hosted Local SEO Express page — not directly to Cash App or Venmo — so you can track
          clicks and show the review prompt after payment.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={qrUi.label}>Amount due ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              placeholder="125.00"
              className={cn(qrUi.input, "mt-1.5")}
            />
          </div>
          <div>
            <label className={qrUi.label}>Note (optional)</label>
            <input
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Garage cleanout"
              className={cn(qrUi.input, "mt-1.5")}
            />
          </div>
        </div>
        {requestError ? (
          <p className="text-sm text-red-600">{requestError}</p>
        ) : null}
        <button
          type="button"
          disabled={creatingRequest}
          onClick={() => void createPaymentRequest()}
          className={cn(qrUi.btnPrimary, "inline-flex items-center gap-2 bg-[#2563EB]")}
        >
          {creatingRequest ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Generate link &amp; QR
        </button>

        {createdRequest ? (
          <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-5">
            <p className="text-sm font-bold text-[#0B1B32]">
              Payment request: ${(createdRequest.amountCents / 100).toFixed(2)}
              {createdRequest.note ? ` — ${createdRequest.note}` : ""}
            </p>
            <p className="mt-2 text-sm text-[#64748B] break-all">{createdRequest.publicPageUrl}</p>
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <img
                src={createdRequest.qrDataUrl}
                alt="Payment request QR"
                className="h-36 w-36 rounded-xl border bg-white p-2"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdRequest.publicPageUrl);
                  setRequestCopied(true);
                  setTimeout(() => setRequestCopied(false), 2000);
                }}
                className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
              >
                <Copy className="h-4 w-4" />
                {requestCopied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showPermanentPage ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cn(qrUi.cardPad, "space-y-4")}>
            <h2 className="text-sm font-bold text-[#0B1B32]">Permanent payment page</h2>
            <p className="text-sm text-[#64748B]">
              Reusable link where customers enter or pick an amount. Alias:{" "}
              <span className="font-mono text-xs">{permanentPageUrl}</span>
            </p>
            <p className="text-sm text-[#64748B] break-all">{publicPageUrl}</p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publicPageUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </button>
            <a
              href={publicPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(qrUi.btnPrimary, "inline-flex items-center gap-2 bg-[#2563EB]")}
            >
              <ExternalLink className="h-4 w-4" /> Open public page
            </a>
          </div>

          <div className={cn(qrUi.cardPad, "flex flex-col items-center")}>
            <h2 className="text-sm font-bold text-[#0B1B32]">Tracked QR (scans analytics)</h2>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR code" className="mt-4 h-48 w-48 rounded-xl border" />
            )}
            <p className="mt-3 text-xs text-[#64748B]">{trackedUrl}</p>
          </div>
        </div>
      ) : (
        <div className={cn(qrUi.cardPad, "space-y-3")}>
          <h2 className="text-sm font-bold text-[#0B1B32]">Payment request template</h2>
          <p className="text-sm text-[#64748B]">
            This campaign is set up for one-off payment requests. Use the form above to create a
            link or QR for each job. Tracked scan URL for posters: {trackedUrl}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-[#BFDBFE] bg-[#1e3a5f] p-8 text-center text-white">
        <p className="text-xl font-extrabold">Scan to pay</p>
        <p className="mt-2 text-sm text-white/80">{campaign.headline}</p>
        {qrDataUrl && showPermanentPage && (
          <img
            src={qrDataUrl}
            alt=""
            className="mx-auto mt-6 h-36 w-36 rounded-lg bg-white p-2"
          />
        )}
        <p className="mt-4 text-xs text-white/70">Venmo · Cash App · PayPal · Zelle</p>
      </div>
    </ModulePage>
  );
}
