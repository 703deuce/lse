"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  Check,
  Copy,
  Download,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import {
  DEFAULT_POSTER_CONFIG,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import { cn } from "@/lib/utils";
import { QR_MOCK_COLORS, qrUi } from "./qr-ui";

const CLAIM_STORAGE_KEY = "lse_qr_claim_token";

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

export function PublicQrGenerator({
  /** Hide outer marketing chrome when nested in the SEO landing page or iframe. */
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [businessName, setBusinessName] = useState("");
  const [placeOrUrl, setPlaceOrUrl] = useState("");
  const [headline, setHeadline] = useState("Love our service?");
  const [description, setDescription] = useState("Scan to leave a quick Google review");
  const [brandColor, setBrandColor] = useState("#16A34A");
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
      format: "letter",
      selectedPhrases: [],
    }),
    [brandColor, description, headline]
  );

  useEffect(() => {
    const target = result?.trackedUrl ?? "https://localseoexpress.com/r/preview";
    let cancelled = false;
    void QRCode.toDataURL(target, {
      width: 560,
      margin: 1,
      color: { dark: "#0B1B32", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [result?.trackedUrl]);

  async function generate() {
    setGenerating(true);
    setError(null);
    setRateLimited(false);
    try {
      const placeId = looksLikePlaceId(placeOrUrl) ? placeOrUrl.trim() : undefined;
      const destinationUrl = placeId ? undefined : placeOrUrl.trim() || undefined;
      const res = await fetch("/api/public/qr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim() || "Your Business",
          placeId,
          destinationUrl,
          headline,
          description,
          brandColor,
          printFormat: "letter",
        }),
      });
      const json = await res.json();
      if (res.status === 429) {
        setRateLimited(true);
        throw new Error(json.error || "Too many requests");
      }
      if (!res.ok) throw new Error(json.error || "Could not generate QR code");
      const created: CreatedResult = {
        trackedUrl: json.campaign.trackedUrl,
        shortCode: json.campaign.shortCode,
        claimToken: json.claimToken,
        businessName: businessName.trim() || "Your Business",
        poster: {
          ...DEFAULT_POSTER_CONFIG,
          title: json.campaign.headline,
          description: json.campaign.description,
          brandColor: json.campaign.brandColor,
          showFooter: true,
          format: "letter",
        },
      };
      setResult(created);
      localStorage.setItem(CLAIM_STORAGE_KEY, created.claimToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
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

  async function copyLink() {
    if (!result?.trackedUrl) return;
    await navigator.clipboard.writeText(result.trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const claimNext = `/reputation/qr-claim?claim=${encodeURIComponent(result?.claimToken ?? "")}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(claimNext)}&claim=${encodeURIComponent(result?.claimToken ?? "")}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(claimNext)}`;

  const shellClass = embedded
    ? "bg-transparent"
    : "min-h-screen bg-[radial-gradient(ellipse_at_top,_#DCFCE7_0%,_#F8FAFC_50%,_#EEF2FF_100%)]";

  return (
    <div className={shellClass}>
      {!embedded ? (
        <header className="border-b border-white/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16A34A] text-sm font-bold text-white">
                LSE
              </span>
              <p className="text-sm font-bold text-[#0B1B32]">Local SEO Express</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/sign-in" className="text-sm font-semibold text-[#475467] hover:text-[#0B1B32]">
                Sign in
              </Link>
              <Link href="/sign-up" className={qrUi.btnPrimary}>
                Create Free Account
              </Link>
            </div>
          </div>
        </header>
      ) : null}

      <div className={cn(!embedded && "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12")}>
        {!embedded ? (
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#0B1B32] sm:text-5xl lg:text-6xl">
              Design your Google review poster
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#486581]">
              Huge preview. Tiny customization. Download free — track scans when you save it.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            className={cn(
              "mx-auto mt-6 max-w-xl rounded-2xl border px-4 py-3 text-sm",
              rateLimited
                ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {error}
          </div>
        ) : null}

        {/* Canva-like: preview dominates */}
        <div
          className={cn(
            "grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]",
            embedded ? "mt-0" : "mt-10"
          )}
        >
          <section className="space-y-4 rounded-[1.75rem] border border-[#E6EAF0] bg-white/90 p-5 shadow-[0_16px_40px_rgba(11,27,50,0.06)] sm:p-6">
            <label className="block">
              <span className={qrUi.label}>Business name</span>
              <input
                className={cn(qrUi.input, "mt-1.5")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Premier Junk Removal"
              />
            </label>
            <label className="block">
              <span className={qrUi.label}>Google review link or Place ID</span>
              <input
                className={cn(qrUi.input, "mt-1.5")}
                value={placeOrUrl}
                onChange={(e) => setPlaceOrUrl(e.target.value)}
                placeholder="Paste Maps / review URL or ChIJ…"
              />
            </label>
            <label className="block">
              <span className={qrUi.label}>Headline</span>
              <input
                className={cn(qrUi.input, "mt-1.5")}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={50}
              />
            </label>
            <label className="block">
              <span className={qrUi.label}>Supporting line</span>
              <input
                className={cn(qrUi.input, "mt-1.5")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={60}
              />
            </label>
            <div>
              <p className={qrUi.label}>Color</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {QR_MOCK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Choose ${color}`}
                    onClick={() => setBrandColor(color)}
                    className={cn(
                      "h-10 w-10 rounded-full ring-offset-2 transition",
                      brandColor === color ? "ring-2 ring-[#0B1B32]" : "ring-1 ring-black/10"
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={generating || !placeOrUrl.trim()}
              className={cn(
                "inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#16A34A] text-base font-bold text-white shadow-[0_12px_28px_rgba(22,163,74,0.35)] transition hover:bg-[#15803D] disabled:opacity-50"
              )}
              onClick={() => void generate()}
            >
              {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {generating ? "Generating…" : "Generate"}
            </button>

            {result ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className={cn(qrUi.btnPrimary, "w-full")}
                  onClick={() => void downloadPoster()}
                >
                  <Download className="h-4 w-4" />
                  Download Poster
                </button>
                <button type="button" className={cn(qrUi.btnSecondary, "w-full")} onClick={downloadQrOnly}>
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
                <button
                  type="button"
                  className={cn(qrUi.btnSecondary, "w-full")}
                  onClick={() => void copyLink()}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy Link"}
                </button>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col items-center">
            <div className="w-full max-w-[520px] scale-100 sm:scale-105 lg:scale-110">
              <div className="rounded-[2rem] bg-white p-4 shadow-[0_28px_70px_rgba(11,27,50,0.14)] ring-1 ring-black/5 sm:p-6">
                <ReviewPosterPreview
                  ref={posterRef}
                  businessName={businessName || "Your Business"}
                  poster={poster}
                  qrDataUrl={qrDataUrl}
                />
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-[#98A2B3]">
              Print-ready preview · final output may vary slightly by printer
            </p>
          </section>
        </div>

        {!embedded ? (
          <section className="mt-14 overflow-hidden rounded-[1.75rem] border border-[#A6F4C5] bg-[linear-gradient(135deg,#0B1B32_0%,#152A45_48%,#166534_100%)] p-6 text-white sm:p-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#86EFAC]">
                Want scan tracking?
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                Save it free — see who scanned
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/80">
                Keep this design, compare placements, and see estimated unique scans after you create
                a free account.
              </p>
              <ul className="mx-auto mt-5 flex max-w-lg flex-col gap-2 text-left text-sm text-white/90">
                {[
                  "Save and edit this QR campaign",
                  "Track total and estimated unique scans",
                  "See review growth correlation (not exact attribution)",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#86EFAC]" />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={result ? signUpHref : "/sign-up"}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#16A34A] px-6 text-sm font-semibold text-white"
                >
                  Create Free Account
                </Link>
                <Link
                  href={result ? signInHref : "/sign-in"}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white"
                >
                  Sign in to claim
                </Link>
              </div>
            </div>
          </section>
        ) : result ? (
          <div className="mt-6 rounded-2xl border border-[#A6F4C5] bg-[#ECFDF3] p-4 text-center text-sm text-[#027A48]">
            Ready to track scans?{" "}
            <Link href={signUpHref} className="font-bold underline">
              Create a free account
            </Link>{" "}
            or{" "}
            <Link href={signInHref} className="font-bold underline">
              sign in to claim
            </Link>
            .
          </div>
        ) : null}
      </div>
    </div>
  );
}
