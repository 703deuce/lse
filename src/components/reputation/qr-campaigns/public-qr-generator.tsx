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
  QrCode,
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

type PreviewTab = "poster" | "qr" | "how";

function looksLikePlaceId(value: string): boolean {
  const v = value.trim();
  return /^ChI[\w-]+$/.test(v) || (v.length > 20 && !v.includes("://") && !v.includes(" "));
}

export function PublicQrGenerator({
  embedded = false,
  /** Full left intro + form / right preview hero (mockup). */
  seoLayout = false,
  /** When true, skip badge/H1/checks (marketing page owns those). */
  hideIntro = false,
}: {
  embedded?: boolean;
  seoLayout?: boolean;
  hideIntro?: boolean;
} = {}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [businessName, setBusinessName] = useState("Premier Junk Removal");
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
  const [tab, setTab] = useState<PreviewTab>("poster");

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
      width: 720,
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
      setTab("poster");
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

  const formCard = (
    <div className="rounded-[1.25rem] border border-[#E6EAF0] bg-white p-5 shadow-[0_12px_36px_rgba(11,27,50,0.06)] sm:p-6">
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="text-[15px] font-bold text-[#0B1B32]">
            <span className="text-[#16A34A]">1.</span> Find your business
          </p>
          <label className="block">
            <span className={qrUi.label}>Business name</span>
            <input
              className={cn(qrUi.input, "mt-1.5 h-11")}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Premier Junk Removal"
            />
          </label>
          <label className="block">
            <span className={qrUi.label}>Google review link</span>
            <input
              className={cn(qrUi.input, "mt-1.5 h-11")}
              value={placeOrUrl}
              onChange={(e) => setPlaceOrUrl(e.target.value)}
              placeholder="Paste Maps / review URL or Place ID"
            />
          </label>
          <div className="text-right">
            <a
              href="https://support.google.com/business/answer/7035772"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#16A34A] hover:underline"
            >
              Find my review link
            </a>
          </div>
        </div>

        <div className="space-y-3 border-t border-[#EEF2F6] pt-5">
          <p className="text-[15px] font-bold text-[#0B1B32]">
            <span className="text-[#16A34A]">2.</span> Customize your poster
          </p>
          <label className="block">
            <span className={qrUi.label}>Headline</span>
            <input
              className={cn(qrUi.input, "mt-1.5 h-11")}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={50}
            />
          </label>
          <label className="block">
            <span className={qrUi.label}>Supporting text</span>
            <input
              className={cn(qrUi.input, "mt-1.5 h-11")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={60}
            />
          </label>
        </div>

        <div className="border-t border-[#EEF2F6] pt-5">
          <p className={qrUi.label}>Poster color</p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {QR_MOCK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Choose ${color}`}
                onClick={() => setBrandColor(color)}
                className={cn(
                  "h-9 w-9 rounded-full transition",
                  brandColor === color
                    ? "ring-2 ring-[#0B1B32] ring-offset-2"
                    : "ring-1 ring-black/10 hover:ring-black/20"
                )}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2.5 pt-0.5">
          <button
            type="button"
            disabled={generating || !placeOrUrl.trim()}
            className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#16A34A] text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(22,163,74,0.28)] transition hover:bg-[#15803D] disabled:opacity-50"
            onClick={() => void generate()}
          >
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
            {generating ? "Generating…" : "Generate My QR Code"}
          </button>
          <p className="text-center text-[12px] leading-5 text-[#98A2B3]">
            100% free to create and download · No credit card required
          </p>
        </div>
      </div>
    </div>
  );

  const previewCard = (
    <div className="flex h-full min-h-full flex-col rounded-[1.25rem] border border-[#E6EAF0] bg-white p-4 shadow-[0_16px_44px_rgba(11,27,50,0.08)] sm:p-5">
      <div className="flex shrink-0 gap-1 rounded-xl bg-[#F1F5F9] p-1">
        {(
          [
            ["poster", "Poster Preview"],
            ["qr", "QR Code Only"],
            ["how", "How it works"],
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

      {/* Light stage pad (~12px): poster grows to fill leftover height/width without feeling jammed */}
      <div className="relative mt-3 min-h-[600px] flex-1 overflow-hidden rounded-xl bg-[#EEF2F7] sm:min-h-[700px]">
        {tab === "how" ? (
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <div className="w-full max-w-md rounded-2xl border border-[#E6EAF0] bg-white p-7 shadow-sm">
              <p className="text-base font-bold text-[#0B1B32]">From scan to Google review</p>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-[#475569]">
                {[
                  "Customer scans your poster QR code",
                  "They land on your tracked Local SEO Express link",
                  "We send them straight to your Google review page",
                  "You unlock scan analytics after a free account",
                ].map((line, i) => (
                  <li key={line} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : tab === "qr" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-5">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Google Review QR Code"
                className="h-auto max-h-[80%] w-auto max-w-[400px] rounded-2xl bg-white p-6 shadow-[0_16px_40px_rgba(11,27,50,0.1)]"
              />
            ) : (
              <div className="flex h-72 w-72 items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white text-sm text-[#94A3B8]">
                Generate to unlock QR
              </div>
            )}
            <p className="mt-5 text-center text-sm font-semibold text-[#0B1B32]">
              QR code only · print-ready PNG
            </p>
          </div>
        ) : (
          <div className="absolute inset-2.5 flex items-center justify-center sm:inset-3">
            <div className="aspect-[3/4] h-full max-h-full w-auto max-w-full">
              <ReviewPosterPreview
                ref={posterRef}
                businessName={businessName || "Your Business"}
                poster={poster}
                qrDataUrl={qrDataUrl}
                size="hero"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 grid shrink-0 gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={!result}
          className={cn(qrUi.btnPrimary, "h-11 w-full text-[13px] disabled:opacity-40")}
          onClick={() => void downloadPoster()}
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="truncate">Download Poster (PDF)</span>
        </button>
        <button
          type="button"
          disabled={!result || !qrDataUrl}
          className={cn(qrUi.btnSecondary, "h-11 w-full text-[13px] disabled:opacity-40")}
          onClick={downloadQrOnly}
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="truncate">Download Image (PNG)</span>
        </button>
        <button
          type="button"
          disabled={!result}
          className={cn(qrUi.btnSecondary, "h-11 w-full text-[13px] disabled:opacity-40")}
          onClick={() => void copyLink()}
        >
          {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
          <span className="truncate">{copied ? "Copied" : "Copy Review Link"}</span>
        </button>
      </div>

      {result && embedded ? (
        <p className="mt-2.5 shrink-0 text-center text-xs leading-5 text-[#64748B]">
          Want scan tracking?{" "}
          <Link href={signUpHref} className="font-bold text-[#16A34A] underline" target="_blank" rel="noopener noreferrer">
            Create a free account
          </Link>{" "}
          or{" "}
          <Link href={signInHref} className="font-bold text-[#16A34A] underline" target="_blank" rel="noopener noreferrer">
            sign in
          </Link>
          .
        </p>
      ) : null}
    </div>
  );

  const intro = !hideIntro ? (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
        Free Google Review QR Code Generator
      </p>
      <h1 className="text-[2.35rem] font-extrabold tracking-tight text-[#0B1B32] sm:text-[2.6rem] sm:leading-[1.08] lg:text-[2.85rem] lg:leading-[1.06]">
        Free Google Review QR Code Generator
      </h1>
      <p className="max-w-[32rem] text-[15px] leading-7 text-[#475569]">
        Create a Google Review QR Code in seconds. Design a printable QR poster, customize the
        colors, and download it instantly. Upgrade later to track scans, compare placements, and
        grow more Google reviews.
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5 text-sm font-semibold text-[#0B1B32]">
        {["No account required", "Instant download", "Works on any device"].map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4 text-[#16A34A]" strokeWidth={2.5} />
            {t}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  if (seoLayout || embedded) {
    return (
      <div>
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

        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.32fr)] lg:gap-7">
          <div className="flex flex-col gap-5">
            {intro}
            <div className="flex flex-1 flex-col">{formCard}</div>
          </div>
          <div className="flex min-h-full flex-col">{previewCard}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#DCFCE7_0%,_#F8FAFC_50%,_#EEF2FF_100%)]">
      <header className="border-b border-white/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <p className="text-sm font-bold text-[#0B1B32]">Local SEO Express</p>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="text-sm font-semibold text-[#475467]">
              Sign in
            </Link>
            <Link href="/sign-up" className={qrUi.btnPrimary}>
              Create Free Account
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <div>
            {intro}
            <div className="mt-6">{formCard}</div>
          </div>
          {previewCard}
        </div>
      </div>
    </div>
  );
}
