"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  Check,
  Copy,
  Download,
  Gift,
  Loader2,
  Lock,
  MapPin,
  QrCode,
  Search,
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

type PlaceCandidate = {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  review_count?: number;
};

function looksLikePlaceId(value: string): boolean {
  const v = value.trim();
  return /^ChI[\w-]+$/.test(v) || (v.length > 20 && !v.includes("://") && !v.includes(" "));
}

export function PublicQrGenerator({
  embedded = false,
  seoLayout = false,
  hideIntro = false,
}: {
  embedded?: boolean;
  seoLayout?: boolean;
  hideIntro?: boolean;
} = {}) {
  const posterRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [businessName, setBusinessName] = useState("Premier Junk Removal");
  const [searchQuery, setSearchQuery] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [headline, setHeadline] = useState("Love our service?");
  const [description, setDescription] = useState("Scan to leave a quick Google review");
  const [brandColor, setBrandColor] = useState("#16A34A");
  const [showBranding, setShowBranding] = useState(true);
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
      showFooter: showBranding,
      format: "letter",
      selectedPhrases: [],
    }),
    [brandColor, description, headline, showBranding]
  );

  const destinationReady = Boolean(placeId.trim() || manualValue.trim());

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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (manualMode) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setCandidates([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError(null);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/public/qr/places-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: q,
              city: city.trim() || undefined,
              state: stateCode.trim() || undefined,
            }),
            signal: controller.signal,
          });
          const json = await res.json();
          if (controller.signal.aborted) return;
          if (!res.ok) {
            setCandidates([]);
            setSearchError(json.error || "Search failed — try adding city/state or Place ID.");
            setSearchOpen(true);
            return;
          }
          setCandidates((json.candidates as PlaceCandidate[]) ?? []);
          setSearchOpen(true);
        } catch (err) {
          if (controller.signal.aborted) return;
          setCandidates([]);
          setSearchError("Search timed out — add city/state or enter a Place ID.");
          setSearchOpen(true);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [manualMode, searchQuery, city, stateCode]);

  function pickPlace(c: PlaceCandidate) {
    setPlaceId(c.place_id);
    setBusinessName(c.name);
    setSearchQuery(c.name);
    setManualValue(c.place_id);
    setCandidates([]);
    setSearchOpen(false);
    setError(null);
  }

  async function generate(): Promise<CreatedResult | null> {
    setGenerating(true);
    setError(null);
    setRateLimited(false);
    try {
      const raw = manualMode ? manualValue.trim() : placeId.trim() || manualValue.trim();
      const resolvedPlaceId = looksLikePlaceId(raw) ? raw : undefined;
      const destinationUrl = resolvedPlaceId ? undefined : raw || undefined;
      if (!resolvedPlaceId && !destinationUrl) {
        throw new Error("Search for your business or enter a Google Place ID / review URL.");
      }
      const res = await fetch("/api/public/qr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim() || "Your Business",
          placeId: resolvedPlaceId,
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
          showFooter: showBranding,
          format: "letter",
        },
      };
      setResult(created);
      localStorage.setItem(CLAIM_STORAGE_KEY, created.claimToken);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPoster() {
    const ready = result ?? (await generate());
    if (!ready || !posterRef.current) return;
    await new Promise((r) => setTimeout(r, 80));
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${ready.shortCode || "google-review"}-poster.png`;
    a.click();
  }

  async function downloadQrOnly() {
    let ready = result;
    if (!ready) ready = await generate();
    if (!ready) return;
    const url =
      qrDataUrl ??
      (await QRCode.toDataURL(ready.trackedUrl, {
        width: 720,
        margin: 1,
        color: { dark: "#0B1B32", light: "#ffffff" },
      }));
    setQrDataUrl(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ready.shortCode || "google-review"}-qr.png`;
    a.click();
  }

  async function copyLink() {
    const ready = result ?? (await generate());
    if (!ready?.trackedUrl) return;
    await navigator.clipboard.writeText(ready.trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const claimNext = `/reputation/qr-claim?claim=${encodeURIComponent(result?.claimToken ?? "")}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(claimNext)}&claim=${encodeURIComponent(result?.claimToken ?? "")}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(claimNext)}`;

  const leftColumn = (
    <div className="flex h-full flex-col">
      {!hideIntro ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#16A34A]">
            Free tool · No credit card required
          </p>
          <h1 className="text-[1.65rem] font-extrabold tracking-tight text-[#14532D] sm:text-[1.9rem] sm:leading-[1.12]">
            Free Google Review QR Code Generator
          </h1>
          <p className="max-w-[28rem] text-[13px] leading-5 text-[#475569]">
            Create a printable Google Review QR poster, customize your design, and download it
            instantly.
          </p>
          <ul className="flex flex-wrap gap-x-3.5 gap-y-1 pt-0.5 text-[12px] font-semibold text-[#0B1B32]">
            {[
              { icon: Gift, label: "100% Free" },
              { icon: Zap, label: "Instant Download" },
              { icon: Lock, label: "No Sign Up Required" },
            ].map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5">
                <item.icon className="h-3.5 w-3.5 text-[#16A34A]" strokeWidth={2.25} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={cn("space-y-3.5", !hideIntro && "mt-4")}>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0B1B32]">
            <span className="text-[#16A34A]">1.</span> Find your business
          </p>
          {!manualMode ? (
            <div ref={searchWrapRef} className="mt-2 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  className={cn(qrUi.input, "h-10 pl-10 pr-10 text-sm")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPlaceId("");
                    setSearchOpen(true);
                  }}
                  onFocus={() => (candidates.length > 0 || searching) && setSearchOpen(true)}
                  placeholder="Search your business name…"
                  autoComplete="off"
                />
                {searching ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#16A34A]" />
                ) : placeId ? (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#16A34A]" />
                ) : null}
                {searchOpen && searchQuery.trim().length >= 2 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-52 overflow-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-[0_16px_40px_rgba(11,27,50,0.12)]">
                    {searching ? (
                      <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-[#64748B]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16A34A]" />
                        Searching… usually a few seconds
                      </p>
                    ) : null}
                    {candidates.map((c) => (
                      <button
                        key={c.place_id}
                        type="button"
                        onClick={() => pickPlace(c)}
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-[#F0FDF4]"
                      >
                        <span className="text-sm font-semibold text-[#0B1B32]">{c.name}</span>
                        <span className="truncate text-xs text-[#64748B]">
                          {c.address || "Google Business Profile"}
                          {c.rating != null ? ` · ★ ${c.rating}` : ""}
                        </span>
                      </button>
                    ))}
                    {!searching && candidates.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs leading-5 text-[#64748B]">
                        {searchError ?? "No matches — try city/state below, or "}
                        <button
                          type="button"
                          className="font-semibold text-[#16A34A] hover:underline"
                          onClick={() => {
                            setManualMode(true);
                            setManualValue(searchQuery);
                            setSearchOpen(false);
                          }}
                        >
                          enter Place ID
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-[1fr_88px] gap-2">
                <input
                  className={cn(qrUi.input, "h-9 text-sm")}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City (helps accuracy)"
                  autoComplete="address-level2"
                />
                <input
                  className={cn(qrUi.input, "h-9 text-sm uppercase")}
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value.slice(0, 2))}
                  placeholder="ST"
                  autoComplete="address-level1"
                  maxLength={2}
                />
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-[#16A34A] hover:underline"
                onClick={() => {
                  setManualMode(true);
                  setSearchOpen(false);
                }}
              >
                or enter Place ID
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <input
                className={cn(qrUi.input, "h-10 text-sm")}
                value={manualValue}
                onChange={(e) => {
                  setManualValue(e.target.value);
                  if (looksLikePlaceId(e.target.value)) setPlaceId(e.target.value.trim());
                }}
                placeholder="Paste Google Place ID or review URL"
              />
              <button
                type="button"
                className="mt-1.5 text-xs font-semibold text-[#16A34A] hover:underline"
                onClick={() => setManualMode(false)}
              >
                or search Google Places
              </button>
            </div>
          )}
        </div>

        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0B1B32]">
            <span className="text-[#16A34A]">2.</span> Customize your design
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={qrUi.label}>Business name</span>
              <input
                className={cn(qrUi.input, "mt-1 h-9 text-sm")}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Premier Junk Removal"
              />
            </label>
            <label className="block">
              <span className={qrUi.label}>Headline</span>
              <input
                className={cn(qrUi.input, "mt-1 h-9 text-sm")}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={50}
              />
            </label>
            <label className="block">
              <span className={qrUi.label}>Scan message</span>
              <input
                className={cn(qrUi.input, "mt-1 h-9 text-sm")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={60}
              />
            </label>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0B1B32]">
            <span className="text-[#16A34A]">3.</span> Choose color
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QR_MOCK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Choose ${color}`}
                onClick={() => setBrandColor(color)}
                className={cn(
                  "h-8 w-8 rounded-full transition",
                  brandColor === color
                    ? "ring-2 ring-[#0B1B32] ring-offset-2"
                    : "ring-1 ring-black/10 hover:ring-black/20"
                )}
                style={{ background: color }}
              />
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-[#334155]">
            <button
              type="button"
              role="switch"
              aria-checked={showBranding}
              onClick={() => setShowBranding((v) => !v)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition",
                showBranding ? "bg-[#16A34A]" : "bg-[#CBD5E1]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                  showBranding ? "left-5" : "left-0.5"
                )}
              />
            </button>
            Show Local SEO Branding
          </label>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={generating || !destinationReady}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(22,163,74,0.28)] transition hover:bg-[#15803D] disabled:opacity-50"
            onClick={() => void downloadQrOnly()}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? "Generating…" : "Download QR Code"}
          </button>
          <button
            type="button"
            disabled={generating || !destinationReady}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white text-[13px] font-bold text-[#0B1B32] transition hover:bg-[#F8FAFC] disabled:opacity-50"
            onClick={() => void generate()}
          >
            <QrCode className="h-4 w-4" />
            Preview Poster
          </button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-4 text-[#98A2B3]">
          <Lock className="h-3 w-3" />
          Your data is safe — we don’t store search data for this free tool.
        </p>
      </div>
    </div>
  );

  const rightColumn = (
    <div className="flex h-full flex-col">
      {/* Same poster component/layout as the app Review Poster page — natural aspect, no squash */}
      <div className="flex min-h-[430px] flex-1 items-center justify-center rounded-2xl bg-[#F3F6FA] px-3 py-4 sm:min-h-[460px]">
        <ReviewPosterPreview
          ref={posterRef}
          businessName={businessName || "Your Business"}
          poster={poster}
          qrDataUrl={qrDataUrl}
          size="hero"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] font-semibold text-[#0B1B32]">
        <button
          type="button"
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-[#16A34A] hover:underline disabled:opacity-40"
          onClick={() => void downloadPoster()}
        >
          <Download className="h-3.5 w-3.5" />
          Download Poster PDF
        </button>
        <button
          type="button"
          disabled={generating}
          className="inline-flex items-center gap-1.5 hover:underline disabled:opacity-40"
          onClick={() => void downloadQrOnly()}
        >
          <QrCode className="h-3.5 w-3.5" />
          Download QR Code
        </button>
        <button
          type="button"
          disabled={generating}
          className="inline-flex items-center gap-1.5 hover:underline disabled:opacity-40"
          onClick={() => void copyLink()}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#16A34A]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy Poster Link"}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#94A3B8]">
        You can print and display this in your store.
      </p>

      {result && embedded ? (
        <p className="mt-2 text-center text-xs leading-5 text-[#64748B]">
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

  if (seoLayout || embedded) {
    return (
      <div>
        {error ? (
          <div
            className={cn(
              "mb-3 rounded-xl border px-3 py-2.5 text-sm",
              rateLimited
                ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[1.25rem] border border-[#E6EAF0] bg-white shadow-[0_16px_40px_rgba(11,27,50,0.07)]">
          <div className="grid items-start lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="border-b border-[#EEF2F6] p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-6">
              {leftColumn}
            </div>
            <div className="bg-[#FBFCFD] p-4 sm:p-5">{rightColumn}</div>
          </div>
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error ? (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-[1.25rem] border border-[#E6EAF0] bg-white shadow-[0_16px_40px_rgba(11,27,50,0.07)]">
          <div className="grid items-start lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="border-b border-[#EEF2F6] p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-6">
              {leftColumn}
            </div>
            <div className="bg-[#FBFCFD] p-4 sm:p-5">{rightColumn}</div>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#64748B]">
          <MapPin className="h-3.5 w-3.5 text-[#16A34A]" />
          Search Google Places or paste a Place ID to generate a real review QR.
        </p>
      </div>
    </div>
  );
}
