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
import {
  QR_MOCK_COLORS,
  qrUi,
} from "@/components/reputation/qr-campaigns/qr-ui";
import {
  DEFAULT_POSTER_CONFIG,
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
  const plansHref = `/businesses/${businessId}/reputation/qr-campaigns/plans`;
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
    void QRCode.toDataURL("https://example.com/r/preview", {
      width: 400,
      margin: 1,
      color: { dark: "#0B1B32", light: "#ffffff" },
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
    <ModulePage className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#16A34A] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <h1 className={qrUi.title}>Create QR Campaign</h1>
          <p className={qrUi.subtitle}>
            Set up a tracked Google review QR code in a few steps.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id < step && setStep(s.id)}
            className={cn(
              "rounded-xl border px-4 py-2 text-xs font-semibold transition",
              step === s.id
                ? "border-[#16A34A] bg-[#ECFDF3] text-[#027A48] shadow-sm"
                : step > s.id
                  ? "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                  : "border-[#E6EAF0] bg-[#F9FAFB] text-[#98A2B3]"
            )}
          >
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px]">
              {step > s.id ? <Check className="h-3 w-3" /> : s.id}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {error ? (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm",
            planLimit
              ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {error}
          {planLimit ? (
            <span className="mt-1 block">
              <Link href={plansHref} className="font-semibold underline">
                View plans
              </Link>{" "}
              or pause an active campaign to free a slot.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={cn(qrUi.cardPad)}>
        {loadingBiz && step === 1 ? (
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin text-[#16A34A]" /> Loading business details…
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">1. Confirm Google destination</h2>
              <p className="mt-1 text-sm text-[#667085]">
                After someone scans your tracked QR, they&apos;ll be sent to this Google review URL.
              </p>
            </div>
            <input
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              className={qrUi.input}
              placeholder="https://search.google.com/local/writereview?placeid=…"
            />
            {defaultDestination && destinationUrl !== defaultDestination ? (
              <button
                type="button"
                className="text-sm font-semibold text-[#16A34A] hover:underline"
                onClick={() => setDestinationUrl(defaultDestination)}
              >
                Use business default
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">2. Name & placement</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Give your campaign a name and tell us where the QR will be displayed.
              </p>
            </div>
            <div>
              <label className={qrUi.label}>Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                placeholder="Front desk poster"
              />
            </div>
            <div>
              <label className={qrUi.label}>Where will this QR live?</label>
              <select
                value={placementType}
                onChange={(e) => setPlacementType(e.target.value as QrPlacementType)}
                className={cn(qrUi.input, "mt-1.5")}
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
                <label className={qrUi.label}>Custom label</label>
                <input
                  value={customPlacementLabel}
                  onChange={(e) => setCustomPlacementLabel(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">3. Customize design</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Choose colors and copy for your print-ready poster.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={qrUi.label}>Headline</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  maxLength={50}
                />
              </div>
              <div>
                <label className={qrUi.label}>Supporting text</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  maxLength={60}
                />
              </div>
            </div>
            <div>
              <label className={qrUi.label}>Poster color</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QR_MOCK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrandColor(color)}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition",
                      brandColor === color ? "scale-110 border-[#0B1B32]" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  >
                    {brandColor === color ? (
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-3">
                <span
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
                    showFooter ? "bg-[#16A34A]" : "bg-[#D0D5DD]"
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
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                      showFooter ? "left-5" : "left-0.5"
                    )}
                  />
                </span>
                <span className="text-sm font-medium text-[#0B1B32]">Show footer</span>
              </label>
              <div className="flex gap-2">
                {(["a4", "a5", "letter"] as const).map((f) => (
                  <label
                    key={f}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      format === f
                        ? "border-[#16A34A] bg-[#ECFDF3] text-[#027A48]"
                        : "border-[#E6EAF0] text-[#667085]"
                    )}
                  >
                    <input
                      type="radio"
                      name="create-format"
                      className="sr-only"
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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#0B1B32]">4. Preview & save</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Review your campaign details before creating.
                </p>
              </div>
              <ul className="space-y-2 rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4 text-sm text-[#475467]">
                <li>
                  <span className="font-semibold text-[#0B1B32]">Name:</span> {name}
                </li>
                <li>
                  <span className="font-semibold text-[#0B1B32]">Placement:</span>{" "}
                  {placementType === "custom"
                    ? customPlacementLabel || "Custom"
                    : QR_PLACEMENT_LABELS[placementType]}
                </li>
                <li className="break-all">
                  <span className="font-semibold text-[#0B1B32]">Destination:</span>{" "}
                  {destinationUrl}
                </li>
              </ul>
              <p className="text-xs text-[#667085]">
                After saving, your poster QR will encode the tracked short link — not the Google URL
                — so every scan can be measured.
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-b from-[#F4F7FB] to-white p-4" ref={previewRef}>
              <ReviewPosterPreview
                businessName={businessName}
                poster={poster}
                qrDataUrl={qrDataUrl}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-[#E6EAF0] pt-5">
          <button
            type="button"
            className={qrUi.btnSecondary}
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              className={qrUi.btnPrimary}
              disabled={!canContinue()}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className={qrUi.btnPrimary}
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
