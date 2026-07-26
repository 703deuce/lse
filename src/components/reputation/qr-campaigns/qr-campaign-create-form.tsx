"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import { rep } from "@/components/reputation/rep-ui";
import {
  DEFAULT_POSTER_CONFIG,
  POSTER_BRAND_COLORS,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import {
  QR_PLACEMENT_LABELS,
  QR_PLACEMENT_TYPES,
  type QrPlacementType,
  type ReviewQrCampaign,
} from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Destination" },
  { id: 2, label: "Name & placement" },
  { id: 3, label: "Design" },
  { id: 4, label: "Preview & save" },
] as const;

export function QrCampaignCreateForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState(false);
  const [businessName, setBusinessName] = useState("Your business");
  const [defaultDestination, setDefaultDestination] = useState("");
  const [loadingBiz, setLoadingBiz] = useState(true);

  const [destinationUrl, setDestinationUrl] = useState("");
  const [name, setName] = useState("Front desk poster");
  const [placementType, setPlacementType] = useState<QrPlacementType>("standard_poster");
  const [customPlacementLabel, setCustomPlacementLabel] = useState("");
  const [headline, setHeadline] = useState(DEFAULT_POSTER_CONFIG.title);
  const [description, setDescription] = useState(DEFAULT_POSTER_CONFIG.description);
  const [brandColor, setBrandColor] = useState(DEFAULT_POSTER_CONFIG.brandColor);
  const [showFooter, setShowFooter] = useState(true);
  const [format, setFormat] = useState<PosterConfig["format"]>("a4");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [accountRes, kitRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/account`),
          fetch(`/api/reputation/review-link/${businessId}`).catch(() => null),
        ]);
        if (cancelled) return;
        if (accountRes.ok) {
          const json = (await accountRes.json()) as { account?: { name?: string } };
          if (json.account?.name) setBusinessName(json.account.name);
        }
        if (kitRes?.ok) {
          const kit = (await kitRes.json()) as {
            businessName?: string;
            placeId?: string | null;
            link?: { review_url?: string };
          };
          if (kit.businessName) setBusinessName(kit.businessName);
          const dest =
            kit.link?.review_url ||
            (kit.placeId
              ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(kit.placeId)}`
              : "");
          if (dest) {
            setDefaultDestination(dest);
            setDestinationUrl(dest);
          }
        }
      } finally {
        if (!cancelled) setLoadingBiz(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const poster: PosterConfig = useMemo(
    () => ({
      title: headline,
      description,
      brandColor,
      showFooter,
      format,
      selectedPhrases: [],
    }),
    [brandColor, description, format, headline, showFooter]
  );

  useEffect(() => {
    // Placeholder QR until save — encodes a temporary path so preview isn't empty.
    void QRCode.toDataURL("https://example.com/r/preview", {
      width: 400,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, []);

  async function create() {
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch("/api/reputation/qr-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim() || "QR Campaign",
          placementType,
          customPlacementLabel:
            placementType === "custom" ? customPlacementLabel.trim() || null : null,
          destinationUrl: destinationUrl.trim(),
          headline,
          description,
          brandColor,
          printFormat: format,
          showFooter,
          posterConfig: poster,
        }),
      });
      const json = (await res.json()) as {
        campaign?: ReviewQrCampaign;
        error?: string;
        limitKey?: string;
      };
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Could not create campaign");
      }
      if (json.campaign?.id) {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns/${json.campaign.id}`);
      } else {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create campaign");
    } finally {
      setSaving(false);
    }
  }

  function canContinue(): boolean {
    if (step === 1) return destinationUrl.trim().length > 8;
    if (step === 2) {
      if (!name.trim()) return false;
      if (placementType === "custom" && !customPlacementLabel.trim()) return false;
      return true;
    }
    return true;
  }

  return (
    <ModulePage className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns`}
            className={cn(rep.link, "mb-2")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <h1 className={rep.title}>Create QR Campaign</h1>
          <p className={rep.subtitle}>
            Set up a tracked Google review QR code in a few steps.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id < step && setStep(s.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              step === s.id
                ? "border-[#137752] bg-[#ECFDF3] text-[#027A48]"
                : step > s.id
                  ? "border-[#D0D5DD] text-[#344054]"
                  : "border-[#E6EAF0] text-[#98A2B3]"
            )}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

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
                Upgrade
              </Link>{" "}
              or pause an active campaign to free a slot.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={cn(rep.card, "p-4 sm:p-5")}>
        {loadingBiz && step === 1 ? (
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading business details…
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[#101828]">Confirm Google destination</h2>
            <p className="text-sm text-[#667085]">
              After someone scans your tracked QR, they&apos;ll be sent to this Google review URL.
            </p>
            <input
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              className={rep.input}
              placeholder="https://search.google.com/local/writereview?placeid=…"
            />
            {defaultDestination && destinationUrl !== defaultDestination ? (
              <button
                type="button"
                className={rep.link}
                onClick={() => setDestinationUrl(defaultDestination)}
              >
                Use business default
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-[#101828]">Name & placement</h2>
            <div>
              <label className={rep.label}>Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(rep.input, "mt-1.5")}
                placeholder="Front desk poster"
              />
            </div>
            <div>
              <label className={rep.label}>Where will this QR live?</label>
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
            {placementType === "custom" ? (
              <div>
                <label className={rep.label}>Custom label</label>
                <input
                  value={customPlacementLabel}
                  onChange={(e) => setCustomPlacementLabel(e.target.value)}
                  className={cn(rep.input, "mt-1.5")}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[#101828]">Customize design</h2>
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
                      "h-9 w-9 rounded-full border-2 transition",
                      brandColor === color ? "scale-110 border-[#101828]" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-3">
                <span
                  className={cn(
                    "relative inline-flex h-5 w-9 rounded-full transition",
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
                      name="create-format"
                      checked={format === f}
                      onChange={() => setFormat(f)}
                    />
                    {f === "letter" ? "Letter" : f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-[#101828]">Preview & save</h2>
              <ul className="space-y-1.5 text-sm text-[#475467]">
                <li>
                  <span className="font-semibold text-[#101828]">Name:</span> {name}
                </li>
                <li>
                  <span className="font-semibold text-[#101828]">Placement:</span>{" "}
                  {placementType === "custom"
                    ? customPlacementLabel || "Custom"
                    : QR_PLACEMENT_LABELS[placementType]}
                </li>
                <li className="break-all">
                  <span className="font-semibold text-[#101828]">Destination:</span>{" "}
                  {destinationUrl}
                </li>
              </ul>
              <p className="text-xs text-[#667085]">
                After saving, your poster QR will encode the tracked short link — not the Google URL
                — so every scan can be measured.
              </p>
            </div>
            <div className="rounded-xl bg-[#F9FAFB] p-3" ref={previewRef}>
              <ReviewPosterPreview
                businessName={businessName}
                poster={poster}
                qrDataUrl={qrDataUrl}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-[#E6EAF0] pt-4">
          <button
            type="button"
            className={rep.btnSecondary}
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              className={rep.btnPrimary}
              disabled={!canContinue()}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className={rep.btnPrimary}
              disabled={saving || !canContinue()}
              onClick={() => void create()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create campaign
            </button>
          )}
        </div>
      </div>
    </ModulePage>
  );
}
