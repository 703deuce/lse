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

type PreviewTab = "digital" | "link" | "print";

function looksLikePlaceId(value: string): boolean {
  const v = value.trim();
  return /^ChI[\w-]+$/.test(v) || (v.length > 20 && !v.includes("://") && !v.includes(" "));
}

export function PublicQrGenerator({
  /** Hide outer marketing chrome when nested in the SEO landing page or iframe. */
  embedded = false,
  /** SaaS-style left form + right preview (mockup #2). */
  seoLayout = false,
}: {
  embedded?: boolean;
  seoLayout?: boolean;
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
  const [tab, setTab] = useState<PreviewTab>("digital");

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
      setTab("digital");
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

  const formFields = (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#16A34A]">
          Step 1 · Find your business
        </p>
        <label className="mt-3 block">
          <span className={qrUi.label}>Search for a business</span>
          <input
            className={cn(qrUi.input, "mt-1.5")}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Search for a Business…"
          />
        </label>
        <label className="mt-3 block">
          <span className={qrUi.label}>Google review link or Place ID</span>
          <input
            className={cn(qrUi.input, "mt-1.5")}
            value={placeOrUrl}
            onChange={(e) => setPlaceOrUrl(e.target.value)}
            placeholder="Paste Maps / review URL or ChIJ…"
          />
        </label>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#16A34A]">
          Step 2 · Customize your poster
        </p>
        <label className="mt-3 block">
          <span className={qrUi.label}>Headline</span>
          <input
            className={cn(qrUi.input, "mt-1.5")}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={50}
          />
        </label>
        <label className="mt-3 block">
          <span className={qrUi.label}>Sub-headline</span>
          <input
            className={cn(qrUi.input, "mt-1.5")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={60}
          />
        </label>
        <label className="mt-3 block">
          <span className={qrUi.label}>Business name on poster</span>
          <input
            className={cn(qrUi.input, "mt-1.5")}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Premier Lawn Service"
          />
        </label>
      </div>

      <div>
        <p className={qrUi.label}>Pick your theme</p>
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
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#16A34A] text-base font-bold text-white shadow-[0_12px_28px_rgba(22,163,74,0.35)] transition hover:bg-[#15803D] disabled:opacity-50"
        onClick={() => void generate()}
      >
        {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {generating ? "Generating…" : "Generate QR Code"}
      </button>
    </div>
  );

  const previewPanel = (
    <div className="rounded-[1.75rem] border border-[#E6EAF0] bg-white p-4 shadow-[0_20px_50px_rgba(11,27,50,0.08)] sm:p-5">
      <div className="flex gap-1 rounded-xl bg-[#F1F5F9] p-1">
        {(
          [
            ["digital", "Digital Poster"],
            ["link", "Review Link"],
            ["print", "Print Poster"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm",
              tab === id
                ? "bg-white text-[#0B1B32] shadow-sm"
                : "text-[#64748B] hover:text-[#0B1B32]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        {tab === "link" ? (
          <div className="w-full rounded-2xl border border-[#E6EAF0] bg-[#F8FAFC] p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#98A2B3]">
              Tracked review link
            </p>
            <p className="mt-3 break-all text-sm font-semibold text-[#0B1B32]">
              {result?.trackedUrl || "Generate your QR code to unlock a tracked link"}
            </p>
            {result ? (
              <button
                type="button"
                onClick={() => void copyLink()}
                className={cn(qrUi.btnSecondary, "mt-4")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="w-full max-w-[420px]">
            <ReviewPosterPreview
              ref={posterRef}
              businessName={businessName || "Your Business"}
              poster={poster}
              qrDataUrl={qrDataUrl}
            />
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={!result}
          className={cn(qrUi.btnPrimary, "w-full disabled:opacity-40")}
          onClick={() => void downloadPoster()}
        >
          <Download className="h-4 w-4" />
          Download Poster
        </button>
        <button
          type="button"
          disabled={!result || !qrDataUrl}
          className={cn(qrUi.btnSecondary, "w-full disabled:opacity-40")}
          onClick={downloadQrOnly}
        >
          <Download className="h-4 w-4" />
          Download QR Only
        </button>
        <Link
          href={result ? signUpHref : "/sign-up"}
          className={cn(qrUi.btnSecondary, "w-full")}
          target={embedded ? "_blank" : undefined}
          rel={embedded ? "noopener noreferrer" : undefined}
        >
          Save for later
        </Link>
      </div>
    </div>
  );

  if (seoLayout) {
    return (
      <div className={cn(embedded ? "bg-transparent" : "")}>
        {error ? (
          <div
            className={cn(
              "mb-4 rounded-2xl border px-4 py-3 text-sm",
              rateLimited
                ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {error}
          </div>
        ) : null}

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <span className="inline-flex items-center rounded-full bg-[#ECFDF3] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#027A48] ring-1 ring-[#A6F4C5]">
              100% free Google Review QR Code Generator
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#0B1B32] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
              Free Google Review QR Code Generator
            </h1>
            <p className="mt-4 text-base leading-7 text-[#475569]">
              Create a Google Review QR Code in seconds with our free Google Review QR Code
              Generator. Design a printable QR poster, customize the colors, and download it
              instantly. Upgrade later to track scans, compare placements, and grow more Google
              reviews.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm font-semibold text-[#0B1B32]">
              {["Free for Everyone", "No Account Required", "High-Quality Downloads"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ECFDF3] text-[#16A34A]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-[1.75rem] border border-[#E6EAF0] bg-white/95 p-5 shadow-[0_16px_40px_rgba(11,27,50,0.06)] sm:p-6">
              {formFields}
            </div>
            {result && embedded ? (
              <div className="mt-4 rounded-2xl border border-[#A6F4C5] bg-[#ECFDF3] p-4 text-center text-sm text-[#027A48]">
                Ready to track scans?{" "}
                <Link href={signUpHref} className="font-bold underline" target="_blank" rel="noopener noreferrer">
                  Create a free account
                </Link>{" "}
                or{" "}
                <Link href={signInHref} className="font-bold underline" target="_blank" rel="noopener noreferrer">
                  sign in to claim
                </Link>
                .
              </div>
            ) : null}
          </div>
          <div className="lg:sticky lg:top-24">{previewPanel}</div>
        </div>
      </div>
    );
  }

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
        {error ? (
          <div
            className={cn(
              "mx-auto mb-6 max-w-xl rounded-2xl border px-4 py-3 text-sm",
              rateLimited
                ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {error}
          </div>
        ) : null}

        <div
          className={cn(
            "grid items-start gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]",
            embedded ? "mt-0" : "mt-2"
          )}
        >
          <section className="rounded-[1.75rem] border border-[#E6EAF0] bg-white/90 p-5 shadow-[0_16px_40px_rgba(11,27,50,0.06)] sm:p-6">
            {formFields}
          </section>
          <section>{previewPanel}</section>
        </div>
      </div>
    </div>
  );
}
