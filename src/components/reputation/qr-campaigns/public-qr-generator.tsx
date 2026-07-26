"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  QrCode,
} from "lucide-react";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import { rep } from "@/components/reputation/rep-ui";
import {
  DEFAULT_POSTER_CONFIG,
  POSTER_BRAND_COLORS,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import { cn } from "@/lib/utils";

const CLAIM_STORAGE_KEY = "lse_qr_claim_token";

const BENEFITS = [
  "See how many people scan your poster",
  "Estimate unique visitors over time",
  "Create placement-specific QR codes (desk, receipts, vehicles)",
  "Never lose track of which printout is working",
];

type CreatedResult = {
  trackedUrl: string;
  shortCode: string;
  claimToken: string;
  businessName: string;
  poster: PosterConfig;
};

function looksLikePlaceId(value: string): boolean {
  const v = value.trim();
  return /^ChI[\w-]+$/.test(v) || (v.length > 20 && !v.includes("://") && !v.includes(" "));
}

export function PublicQrGenerator() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [businessName, setBusinessName] = useState("");
  const [placeOrUrl, setPlaceOrUrl] = useState("");
  const [headline, setHeadline] = useState(DEFAULT_POSTER_CONFIG.title);
  const [description, setDescription] = useState(DEFAULT_POSTER_CONFIG.description);
  const [brandColor, setBrandColor] = useState(DEFAULT_POSTER_CONFIG.brandColor);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const poster: PosterConfig = useMemo(
    () => ({
      title: headline,
      description,
      brandColor,
      showFooter: true,
      format: "a4",
      selectedPhrases: [],
    }),
    [brandColor, description, headline]
  );

  const previewQrTarget = result?.trackedUrl ?? null;

  useEffect(() => {
    const target = previewQrTarget;
    if (!target) {
      // Show a neutral preview QR while editing.
      void QRCode.toDataURL("https://example.com/r/preview", {
        width: 400,
        margin: 1,
        color: { dark: "#111827", light: "#ffffff" },
      }).then(setQrDataUrl);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(target, {
      width: 400,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [previewQrTarget]);

  async function generate() {
    setGenerating(true);
    setError(null);
    setRateLimited(false);
    try {
      const trimmed = placeOrUrl.trim();
      const body: Record<string, string> = {
        businessName: businessName.trim(),
        headline,
        description,
        brandColor,
        printFormat: "a4",
      };
      if (looksLikePlaceId(trimmed)) body.placeId = trimmed;
      else body.destinationUrl = trimmed;

      const res = await fetch("/api/public/qr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        campaign?: {
          shortCode: string;
          trackedUrl: string;
          headline?: string;
          description?: string;
          brandColor?: string;
          posterConfig?: PosterConfig;
        };
        claimToken?: string;
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 429) setRateLimited(true);
        throw new Error(json.error ?? "Could not generate QR code");
      }
      if (!json.campaign?.trackedUrl || !json.claimToken) {
        throw new Error("Unexpected response from QR generator");
      }

      try {
        localStorage.setItem(CLAIM_STORAGE_KEY, json.claimToken);
      } catch {
        // ignore storage failures (private mode, etc.)
      }

      // Analytics endpoint only accepts authenticated product events — skip for public.

      setResult({
        trackedUrl: json.campaign.trackedUrl,
        shortCode: json.campaign.shortCode,
        claimToken: json.claimToken,
        businessName: businessName.trim(),
        poster: json.campaign.posterConfig ?? {
          ...poster,
          title: json.campaign.headline ?? headline,
          description: json.campaign.description ?? description,
          brandColor: json.campaign.brandColor ?? brandColor,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate QR code");
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadPoster() {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${result?.shortCode || "google-review"}-poster.png`;
    a.click();
  }

  function downloadQrOnly() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${result?.shortCode || "google-review"}-qr.png`;
    a.click();
  }

  const claimToken = result?.claimToken ?? "";
  const claimNext = `/reputation/qr-claim?claim=${encodeURIComponent(claimToken)}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(claimNext)}&claim=${encodeURIComponent(claimToken)}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(claimNext)}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#ECFDF3_0%,_#F8FAFC_45%,_#EEF2FF_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#027A48]">
            Free Google Review QR
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#101828] sm:text-4xl">
            Create a Free Google Review QR Code
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#475467] sm:text-base">
            Design a print-ready poster in seconds. We encode a tracked short link so you can
            measure scans later — then visitors are sent to Google Reviews.
          </p>
        </div>

        {error ? (
          <div
            className={cn(
              "mx-auto mt-6 max-w-2xl rounded-xl border px-4 py-3 text-sm",
              rateLimited
                ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {error}
            {rateLimited ? (
              <span className="mt-1 block">
                You&apos;ve generated several codes recently. Wait a bit and try again, or create a
                free account to save and manage them.
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className={cn(rep.card, "p-4 sm:p-5")}>
            {!result ? (
              <div className="space-y-4">
                <div>
                  <label className={rep.label}>Business name</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={cn(rep.input, "mt-1.5")}
                    placeholder="Acme Plumbing"
                  />
                </div>
                <div>
                  <label className={rep.label}>Google Place ID or review URL</label>
                  <input
                    value={placeOrUrl}
                    onChange={(e) => setPlaceOrUrl(e.target.value)}
                    className={cn(rep.input, "mt-1.5")}
                    placeholder="ChIJ… or https://search.google.com/local/writereview?placeid=…"
                  />
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
                  <label className={rep.label}>Color presets</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {POSTER_BRAND_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBrandColor(color)}
                        className={cn(
                          "h-9 w-9 rounded-full border-2 transition",
                          brandColor === color
                            ? "scale-110 border-[#101828]"
                            : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={
                    generating || !businessName.trim() || placeOrUrl.trim().length < 8
                  }
                  className={cn(rep.btnPrimary, "w-full sm:w-auto")}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  Generate QR code
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className={rep.label}>Your tracked review link</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <input
                      readOnly
                      value={result.trackedUrl}
                      className={cn(rep.input, "min-w-0 flex-1")}
                    />
                    <button type="button" onClick={() => void copyLink()} className={rep.btnSecondary}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#667085]">
                    This short link records visits, then redirects to Google Reviews. The poster QR
                    encodes this tracked URL — not a direct Google link.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void downloadPoster()} className={rep.btnPrimary}>
                    <Download className="h-4 w-4" />
                    Download poster
                  </button>
                  <button
                    type="button"
                    onClick={downloadQrOnly}
                    disabled={!qrDataUrl}
                    className={rep.btnSecondary}
                  >
                    <Download className="h-4 w-4" />
                    Download QR only
                  </button>
                  <button
                    type="button"
                    className={rep.btnSecondary}
                    onClick={() => {
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Create another
                  </button>
                </div>

                <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] p-4">
                  <h2 className="text-lg font-bold text-[#027A48]">
                    Save your QR code and track how many people scan it
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {BENEFITS.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-[#027A48]">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={signUpHref} className={rep.btnPrimary}>
                      Create free account
                    </Link>
                    <Link href={signInHref} className={rep.btnSecondary}>
                      Sign in to claim
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E6EAF0] bg-white/80 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:sticky lg:top-6 lg:self-start">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              Live poster preview
            </p>
            <ReviewPosterPreview
              ref={posterRef}
              businessName={result?.businessName || businessName || "Your business"}
              poster={result?.poster ?? poster}
              qrDataUrl={qrDataUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
