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
  Smartphone,
  Sparkles,
  TrendingUp,
  Zap,
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

export function PublicQrGenerator() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [businessName, setBusinessName] = useState("");
  const [placeOrUrl, setPlaceOrUrl] = useState("");
  const [qrName, setQrName] = useState("Front Desk Poster");
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
      width: 480,
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
          businessName: businessName.trim() || qrName,
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
        businessName: businessName.trim() || qrName,
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

  async function downloadPoster(ext: "png" | "jpg" = "png") {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${result?.shortCode || "google-review"}-poster.${ext === "jpg" ? "jpg" : "png"}`;
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

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#DCFCE7_0%,_#F4F7FB_42%,_#EEF2FF_100%)]">
      {/* Public top bar */}
      <header className="border-b border-white/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16A34A] text-sm font-bold text-white">
              LSE
            </span>
            <div>
              <p className="text-sm font-bold text-[#0B1B32]">Local SEO Express</p>
              <p className="text-[11px] text-[#667085]">Free Google Review QR</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className={qrUi.btnGhost}>
              Sign in
            </Link>
            <Link href="/sign-up" className={qrUi.btnPrimary}>
              Create Free Account
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#027A48]">
            Public Google Review QR Generator
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#0B1B32] sm:text-5xl">
            Create a Free Google Review QR Code
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#486581]">
            Design a print-ready poster in seconds. No account needed to download. Track scans after
            you save it to a free account.
          </p>
        </div>

        {error ? (
          <div
            className={cn(
              "mx-auto mt-6 max-w-3xl rounded-2xl border px-4 py-3 text-sm",
              rateLimited
                ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {error}
          </div>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          {/* Config */}
          <section className={cn(qrUi.cardPad, "space-y-5")}>
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">1. Find your business</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Enter your business name and Google Place ID or review link.
              </p>
            </div>

            <label className="block">
              <span className={qrUi.label}>Business name</span>
              <input
                className={qrUi.input}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Premier Junk Removal"
              />
            </label>

            <label className="block">
              <span className={qrUi.label}>Google Maps URL, review link, or Place ID</span>
              <input
                className={qrUi.input}
                value={placeOrUrl}
                onChange={(e) => setPlaceOrUrl(e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=… or ChIJ…"
              />
            </label>

            <label className="block">
              <span className={qrUi.label}>QR code name</span>
              <input
                className={qrUi.input}
                value={qrName}
                onChange={(e) => setQrName(e.target.value)}
                placeholder="Front Desk Poster"
              />
            </label>

            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">2. Customize poster</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={qrUi.label}>Headline</span>
                  <input
                    className={qrUi.input}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    maxLength={50}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={qrUi.label}>Supporting text</span>
                  <input
                    className={qrUi.input}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={60}
                  />
                </label>
              </div>
              <p className={cn(qrUi.label, "mt-4")}>Poster color</p>
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
              className={cn(qrUi.btnPrimary, "w-full disabled:opacity-50")}
              onClick={() => void generate()}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate QR Code"}
            </button>

            {result ? (
              <div className="space-y-3 rounded-2xl border border-[#A6F4C5] bg-[#ECFDF3] p-4">
                <p className="text-sm font-semibold text-[#027A48]">Your tracked link is ready</p>
                <div className="flex flex-wrap gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-xs text-[#0B1B32] ring-1 ring-[#D1FADF]">
                    {result.trackedUrl}
                  </code>
                  <button type="button" className={qrUi.btnSecondary} onClick={() => void copyLink()}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={qrUi.btnPrimary} onClick={() => void downloadPoster("png")}>
                    <Download className="h-4 w-4" />
                    PNG Poster
                  </button>
                  <button type="button" className={qrUi.btnSecondary} onClick={() => void downloadPoster("jpg")}>
                    JPG
                  </button>
                  <button type="button" className={qrUi.btnSecondary} onClick={downloadQrOnly}>
                    QR Only
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Preview */}
          <section className={cn(qrUi.cardPad, "bg-[linear-gradient(180deg,#F8FAFC_0%,#ffffff_40%)]")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#98A2B3]">
                  Live preview
                </p>
                <h2 className="text-lg font-bold text-[#0B1B32]">Poster</h2>
              </div>
              <span className={qrUi.badgeActive}>Print ready</span>
            </div>
            <ReviewPosterPreview
              ref={posterRef}
              businessName={businessName || "Your Business"}
              poster={poster}
              qrDataUrl={qrDataUrl}
            />
            <p className="mt-4 text-center text-xs text-[#98A2B3]">
              Final print may vary slightly by paper size and printer.
            </p>
          </section>
        </div>

        {/* Benefits row */}
        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Zap, title: "No account needed", body: "Generate and download your first poster free." },
            { icon: Download, title: "Instant download", body: "PNG poster and QR-only files in one click." },
            { icon: Smartphone, title: "Mobile friendly", body: "Customers scan and open Google Reviews fast." },
            { icon: TrendingUp, title: "Track after signup", body: "Save the project to see total and unique scans." },
          ].map((item) => (
            <div key={item.title} className={cn(qrUi.cardPad, "text-center")}>
              <item.icon className="mx-auto h-5 w-5 text-[#16A34A]" />
              <p className="mt-2 text-sm font-bold text-[#0B1B32]">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#667085]">{item.body}</p>
            </div>
          ))}
        </section>

        {/* Conversion CTA */}
        <section className="mt-10 overflow-hidden rounded-[1.75rem] border border-[#A6F4C5] bg-[linear-gradient(135deg,#0B1B32_0%,#152A45_48%,#166534_100%)] p-6 text-white shadow-[0_20px_50px_rgba(11,27,50,0.25)] sm:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#86EFAC]">
                Save your QR code
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                Track how many people scan it
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
                Create a free account to keep this design, see total scans and estimated unique scans,
                and compare placements like front desk vs receipts.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-white/90">
                {[
                  "Save and edit this QR campaign",
                  "Track total and estimated unique scans",
                  "Compare posters by placement",
                  "Get new-review growth correlation",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#86EFAC]" />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={result ? signUpHref : "/sign-up"}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#16A34A] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(22,163,74,0.35)]"
                >
                  Create Free Account
                </Link>
                <Link
                  href={result ? signInHref : "/sign-in"}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 text-sm font-semibold text-white"
                >
                  Sign in to claim
                </Link>
              </div>
            </div>
            <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <ReviewPosterPreview
                businessName={businessName || "Your Business"}
                poster={poster}
                qrDataUrl={qrDataUrl}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
