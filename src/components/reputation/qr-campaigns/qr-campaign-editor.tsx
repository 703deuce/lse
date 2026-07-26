"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Info,
  Loader2,
  BarChart3,
  Pause,
  Play,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import { RepBadge, RepMetricCard, rep } from "@/components/reputation/rep-ui";
import {
  DEFAULT_POSTER_CONFIG,
  POSTER_BRAND_COLORS,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import {
  QR_PLACEMENT_LABELS,
  QR_PLACEMENT_TYPES,
  type QrCampaignStatus,
  type QrPlacementType,
  type QrPrintFormat,
  type ReviewQrCampaign,
} from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

type LoadResponse = {
  campaign?: ReviewQrCampaign;
  campaigns?: ReviewQrCampaign[];
  trackedUrl?: string;
  error?: string;
  limitKey?: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function posterFormatFromPrint(format: QrPrintFormat): PosterConfig["format"] {
  if (format === "a5" || format === "letter") return format;
  return "a4";
}

export function QrCampaignEditor({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId?: string;
}) {
  const router = useRouter();
  const posterRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [businessName, setBusinessName] = useState("Your business");
  const [campaign, setCampaign] = useState<ReviewQrCampaign | null>(null);
  const [trackedUrl, setTrackedUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [placementType, setPlacementType] = useState<QrPlacementType>("standard_poster");
  const [customPlacementLabel, setCustomPlacementLabel] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [headline, setHeadline] = useState(DEFAULT_POSTER_CONFIG.title);
  const [description, setDescription] = useState(DEFAULT_POSTER_CONFIG.description);
  const [brandColor, setBrandColor] = useState(DEFAULT_POSTER_CONFIG.brandColor);
  const [showFooter, setShowFooter] = useState(true);
  const [printFormat, setPrintFormat] = useState<QrPrintFormat>("a4");
  const [status, setStatus] = useState<QrCampaignStatus>("active");

  const applyCampaign = useCallback((c: ReviewQrCampaign, url?: string) => {
    setCampaign(c);
    setTrackedUrl(url || (typeof window !== "undefined" ? `${window.location.origin}/r/${c.shortCode}` : `/r/${c.shortCode}`));
    setName(c.name);
    setPlacementType(c.placementType);
    setCustomPlacementLabel(c.customPlacementLabel ?? "");
    setDestinationUrl(c.destinationUrl);
    setHeadline(c.headline || c.posterConfig?.title || DEFAULT_POSTER_CONFIG.title);
    setDescription(c.description || c.posterConfig?.description || DEFAULT_POSTER_CONFIG.description);
    setBrandColor(c.brandColor || c.posterConfig?.brandColor || DEFAULT_POSTER_CONFIG.brandColor);
    setShowFooter(c.showFooter ?? c.posterConfig?.showFooter ?? true);
    setPrintFormat(c.printFormat === "qr_only" ? "a4" : c.printFormat);
    setStatus(c.status);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlanLimit(false);
    try {
      const accountRes = await fetch(`/api/businesses/${businessId}/account`);
      if (accountRes.ok) {
        const accountJson = (await accountRes.json()) as { account?: { name?: string } };
        if (accountJson.account?.name) setBusinessName(accountJson.account.name);
      }

      const url = campaignId
        ? `/api/reputation/qr-campaigns/${campaignId}?businessId=${encodeURIComponent(businessId)}`
        : `/api/reputation/qr-campaigns?businessId=${encodeURIComponent(businessId)}&ensureDefault=1`;
      const res = await fetch(url);
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Failed to load QR campaign");
      }

      const c = json.campaign ?? json.campaigns?.[0] ?? null;
      if (!c) throw new Error("No QR campaign found. Create one to get started.");
      applyCampaign(c, json.trackedUrl);
      if (!campaignId && c.id) {
        router.replace(`/businesses/${businessId}/reputation/qr-campaigns/${c.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [applyCampaign, businessId, campaignId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!trackedUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(trackedUrl, {
      width: 400,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [trackedUrl]);

  const poster: PosterConfig = {
    title: headline,
    description,
    brandColor,
    showFooter,
    format: posterFormatFromPrint(printFormat),
    selectedPhrases: campaign?.posterConfig?.selectedPhrases ?? [],
  };

  async function save() {
    if (!campaign) return;
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          patch: {
            name: name.trim() || "QR Campaign",
            placementType,
            customPlacementLabel:
              placementType === "custom" ? customPlacementLabel.trim() || null : null,
            destinationUrl: destinationUrl.trim(),
            headline,
            description,
            brandColor,
            printFormat,
            showFooter,
            status,
            posterConfig: poster,
          },
        }),
      });
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Save failed");
      }
      if (json.campaign) applyCampaign(json.campaign, json.trackedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const next: QrCampaignStatus = status === "active" ? "paused" : "active";
    setStatus(next);
    if (!campaign) return;
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, patch: { status: next } }),
      });
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        setStatus(status);
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Could not update status");
      }
      if (json.campaign) applyCampaign(json.campaign, json.trackedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!campaign) return;
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "duplicate" }),
      });
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Duplicate failed");
      }
      if (json.campaign?.id) {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns/${json.campaign.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyTrackedLink() {
    if (!trackedUrl) return;
    await navigator.clipboard.writeText(trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadPoster() {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${campaign?.shortCode || "qr"}-poster.png`;
    a.click();
  }

  function downloadQrOnly() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${campaign?.shortCode || "qr"}-code.png`;
    a.click();
  }

  if (loading) {
    return (
      <ModulePage className={rep.page}>
        <div className="flex items-center gap-2 py-12 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin text-[#137752]" />
          Loading QR campaign…
        </div>
      </ModulePage>
    );
  }

  if (!campaign) {
    return (
      <ModulePage className={rep.page}>
        <div className={cn(rep.card, "border-dashed p-8 text-center")}>
          <h2 className="text-lg font-semibold text-[#101828]">QR campaign unavailable</h2>
          <p className="mt-2 text-sm text-[#667085]">{error ?? "Could not load this campaign."}</p>
          {planLimit ? (
            <p className="mt-3 text-sm text-[#B54708]">
              Your plan limit was reached. Pause another campaign or{" "}
              <Link href={`/businesses/${businessId}/settings`} className={rep.link}>
                upgrade
              </Link>
              .
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void load()} className={rep.btnSecondary}>
              Retry
            </button>
            <Link
              href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
              className={rep.btnPrimary}
            >
              Create campaign
            </Link>
          </div>
        </div>
      </ModulePage>
    );
  }

  return (
    <ModulePage className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={cn(rep.title, "inline-flex items-center gap-2")}>
            QR Campaign
            <Info className="h-4 w-4 text-[#98A2B3]" aria-hidden />
          </h1>
          <p className={rep.subtitle}>
            Track scans from printed posters, then send visitors to your Google review page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns`}
            className={rep.btnSecondary}
          >
            All campaigns
          </Link>
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns/${campaign.id}/analytics`}
            className={rep.btnSecondary}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-2 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Your tracked link records each visit, then redirects to Google Reviews. Print the QR that
          encodes this tracked URL — never a direct Google URL — so scans stay measurable.
        </p>
      </div>

      {campaign.migratedFromLinkId ? (
        <div className="rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]">
          This campaign was migrated from an older review link. Previously printed QR codes that
          pointed directly at Google cannot be retroactively tracked — reprint using this tracked
          link going forward.
        </div>
      ) : null}

      {error ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            planLimit
              ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {error}
          {planLimit ? (
            <span className="mt-1 block">
              <Link href={`/businesses/${businessId}/settings`} className="font-semibold underline">
                Upgrade your plan
              </Link>{" "}
              to create or activate more QR campaigns.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <RepMetricCard label="Total scans" value={campaign.totalScans.toLocaleString()} />
        <RepMetricCard
          label="Est. unique scans"
          value={campaign.estimatedUniqueScans.toLocaleString()}
          hint="Approximate unique visitors (24h window)"
        />
        <RepMetricCard label="Last scanned" value={formatDate(campaign.lastScannedAt)} />
      </div>

      <div className={cn(rep.card, "overflow-hidden")}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4 border-b border-[#E6EAF0] p-4 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RepBadge tone={status === "active" ? "green" : status === "paused" ? "amber" : "gray"}>
                  {status}
                </RepBadge>
                <span className="text-xs text-[#667085]">/{campaign.shortCode}</span>
              </div>
              <button
                type="button"
                onClick={() => void toggleActive()}
                disabled={saving}
                className={rep.btnSecondary}
              >
                {status === "active" ? (
                  <>
                    <Pause className="h-4 w-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Activate
                  </>
                )}
              </button>
            </div>

            <div>
              <label className={rep.label}>Tracked link</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input readOnly value={trackedUrl} className={cn(rep.input, "min-w-0 flex-1")} />
                <button type="button" onClick={() => void copyTrackedLink()} className={rep.btnSecondary}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <a
                  href={trackedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={rep.btnSecondary}
                >
                  <ExternalLink className="h-4 w-4" />
                  Test
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={rep.label}>Campaign name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(rep.input, "mt-1.5")}
                  maxLength={80}
                />
              </div>
              <div>
                <label className={rep.label}>Placement</label>
                <select
                  value={placementType}
                  onChange={(e) => setPlacementType(e.target.value as QrPlacementType)}
                  className={cn(rep.select, "mt-1.5 w-full")}
                >
                  {QR_PLACEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {QR_PLACEMENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {placementType === "custom" ? (
              <div>
                <label className={rep.label}>Custom placement label</label>
                <input
                  value={customPlacementLabel}
                  onChange={(e) => setCustomPlacementLabel(e.target.value)}
                  className={cn(rep.input, "mt-1.5")}
                  placeholder="e.g. Waiting room wall"
                />
              </div>
            ) : null}

            <div>
              <label className={rep.label}>Google destination URL</label>
              <input
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                className={cn(rep.input, "mt-1.5")}
                placeholder="https://search.google.com/local/writereview?placeid=…"
              />
              <p className="mt-1 text-xs text-[#667085]">
                Where visitors land after the tracked redirect — not encoded in the QR.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={rep.label}>Headline</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className={cn(rep.input, "mt-1.5")}
                  maxLength={50}
                />
              </div>
              <div>
                <label className={rep.label}>Supporting text</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(rep.input, "mt-1.5")}
                  maxLength={60}
                />
              </div>
            </div>

            <div>
              <label className={rep.label}>Brand color</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {POSTER_BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrandColor(color)}
                    className={cn(
                      "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition",
                      brandColor === color ? "scale-110 border-[#101828]" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Brand color ${color}`}
                  >
                    {brandColor === color ? (
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EAF0] pt-3">
              <label className="flex cursor-pointer items-center gap-3">
                <span
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 rounded-full transition",
                    showFooter ? "bg-[#137752]" : "bg-[#D0D5DD]"
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={showFooter}
                    onChange={(e) => setShowFooter(e.target.checked)}
                  />
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                      showFooter ? "left-4" : "left-0.5"
                    )}
                  />
                </span>
                <span className="text-sm font-medium text-[#101828]">Show footer</span>
              </label>
              <div className="flex gap-3">
                {(["a4", "a5", "letter"] as const).map((f) => (
                  <label key={f} className="flex items-center gap-1.5 text-xs capitalize text-[#667085]">
                    <input
                      type="radio"
                      name="format"
                      checked={printFormat === f}
                      onChange={() => setPrintFormat(f)}
                    />
                    {f === "letter" ? "Letter" : f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[#E6EAF0] pt-4">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={rep.btnPrimary}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button type="button" onClick={() => void downloadPoster()} className={rep.btnSecondary}>
                <Download className="h-4 w-4" />
                Download Poster
              </button>
              <button
                type="button"
                onClick={downloadQrOnly}
                disabled={!qrDataUrl}
                className={rep.btnSecondary}
              >
                <Download className="h-4 w-4" />
                Download QR Only
              </button>
              <button
                type="button"
                onClick={() => void duplicate()}
                disabled={saving}
                className={rep.btnSecondary}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-b from-[#F9FAFB] to-[#F2F4F7]/80 p-4 lg:sticky lg:top-4 lg:self-start">
            <ReviewPosterPreview
              ref={posterRef}
              businessName={businessName}
              poster={poster}
              qrDataUrl={qrDataUrl}
            />
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#667085]">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Preview uses your tracked link QR. Final print may vary slightly.
            </p>
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
