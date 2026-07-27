"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type PlaceCandidate = {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  review_count?: number;
};

type LayoutId = "badge" | "bar" | "cards";

const LAYOUTS: { id: LayoutId; label: string; blurb: string }[] = [
  { id: "badge", label: "Review badge", blurb: "Compact stars + rating for sidebars and footers." },
  { id: "bar", label: "Review bar", blurb: "Full-width strip with rating and CTA." },
  { id: "cards", label: "Review cards", blurb: "Show up to three customer quotes." },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function reviewUrl(placeId: string): string {
  return `https://search.google.com/local/reviews?placeid=${encodeURIComponent(placeId)}`;
}

function buildEmbed(params: {
  layout: LayoutId;
  businessName: string;
  placeId: string;
  rating: number;
  reviewCount: number;
  quotes: string[];
}): string {
  const name = escapeHtml(params.businessName || "Our business");
  const rating = Number.isFinite(params.rating) ? params.rating : 5;
  const count = Math.max(0, Math.floor(params.reviewCount || 0));
  const href = escapeHtml(reviewUrl(params.placeId || "PLACE_ID"));
  const starText = stars(rating);
  const quotes = params.quotes.map((q) => q.trim()).filter(Boolean).slice(0, 3);

  const css = `<style>
.lse-rw{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0B1220;line-height:1.45}
.lse-rw a{color:inherit;text-decoration:none}
.lse-rw-badge{display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #E6EAF0;border-radius:12px;background:#fff}
.lse-rw-stars{color:#FDB022;letter-spacing:1px;font-size:16px}
.lse-rw-meta{font-size:13px;color:#344054}
.lse-rw-meta strong{display:block;font-size:14px;color:#0B1220}
.lse-rw-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid #E6EAF0;border-radius:14px;background:#F7FAF8}
.lse-rw-cta{display:inline-flex;align-items:center;padding:8px 12px;border-radius:8px;background:#137752;color:#fff!important;font-size:13px;font-weight:600}
.lse-rw-cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.lse-rw-card{padding:14px;border:1px solid #E6EAF0;border-radius:12px;background:#fff}
.lse-rw-card p{margin:8px 0 0;font-size:13px;color:#475467}
.lse-rw-foot{margin-top:8px;font-size:11px;color:#98A2B3}
</style>`;

  if (params.layout === "badge") {
    return `${css}
<div class="lse-rw">
  <a class="lse-rw-badge" href="${href}" target="_blank" rel="noopener noreferrer">
    <span class="lse-rw-stars" aria-hidden="true">${starText}</span>
    <span class="lse-rw-meta"><strong>${rating.toFixed(1)} on Google</strong>${count.toLocaleString()} reviews · ${name}</span>
  </a>
  <div class="lse-rw-foot">Powered by Local SEO Express</div>
</div>`;
  }

  if (params.layout === "bar") {
    return `${css}
<div class="lse-rw">
  <div class="lse-rw-bar">
    <div>
      <div class="lse-rw-stars" aria-hidden="true">${starText}</div>
      <div class="lse-rw-meta"><strong>${name}</strong>${rating.toFixed(1)} average from ${count.toLocaleString()} Google reviews</div>
    </div>
    <a class="lse-rw-cta" href="${href}" target="_blank" rel="noopener noreferrer">Read reviews</a>
  </div>
  <div class="lse-rw-foot">Powered by Local SEO Express</div>
</div>`;
  }

  const cards =
    quotes.length > 0
      ? quotes
          .map(
            (q) => `<div class="lse-rw-card"><div class="lse-rw-stars" aria-hidden="true">${starText}</div><p>“${escapeHtml(q)}”</p></div>`
          )
          .join("\n")
      : `<div class="lse-rw-card"><div class="lse-rw-stars" aria-hidden="true">${starText}</div><p>Customers rate ${name} ${rating.toFixed(1)} stars on Google (${count.toLocaleString()} reviews).</p></div>`;

  return `${css}
<div class="lse-rw">
  <div class="lse-rw-cards">
${cards}
  </div>
  <div style="margin-top:12px"><a class="lse-rw-cta" href="${href}" target="_blank" rel="noopener noreferrer">See all Google reviews</a></div>
  <div class="lse-rw-foot">Powered by Local SEO Express</div>
</div>`;
}

function buildJsonLd(params: {
  businessName: string;
  rating: number;
  reviewCount: number;
}): string {
  const payload = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: params.businessName || "Business",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Number(params.rating.toFixed(1)),
      reviewCount: Math.max(0, Math.floor(params.reviewCount || 0)),
      bestRating: 5,
      worstRating: 1,
    },
  };
  return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
}

export function ReviewWidgetGenerator({ embed = false }: { embed?: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [rating, setRating] = useState(4.8);
  const [reviewCount, setReviewCount] = useState(120);
  const [layout, setLayout] = useState<LayoutId>("badge");
  const [quote1, setQuote1] = useState("");
  const [quote2, setQuote2] = useState("");
  const [quote3, setQuote3] = useState("");
  const [copied, setCopied] = useState<"embed" | "jsonld" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setBusinessName(selected.name);
    setPlaceId(selected.place_id);
    if (typeof selected.rating === "number") setRating(selected.rating);
    if (typeof selected.review_count === "number") setReviewCount(selected.review_count);
  }, [selected]);

  const embedCode = useMemo(
    () =>
      buildEmbed({
        layout,
        businessName,
        placeId,
        rating,
        reviewCount,
        quotes: [quote1, quote2, quote3],
      }),
    [layout, businessName, placeId, rating, reviewCount, quote1, quote2, quote3]
  );

  const jsonLd = useMemo(
    () => buildJsonLd({ businessName, rating, reviewCount }),
    [businessName, rating, reviewCount]
  );

  async function searchPlaces() {
    setSearching(true);
    setError(null);
    setCandidates([]);
    try {
      const res = await fetch("/api/public/qr/places-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        candidates?: PlaceCandidate[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Search failed");
      setCandidates(json.candidates ?? []);
      if (!(json.candidates ?? []).length) {
        setError("No matching businesses found. Enter details manually below.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function copy(kind: "embed" | "jsonld") {
    await navigator.clipboard.writeText(kind === "embed" ? embedCode : jsonLd);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className={cn(embed ? "min-h-screen bg-[#F7FAF8] p-4" : "mx-auto max-w-3xl px-4 py-10")}>
      {!embed ? (
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#027A48]">
            Free tool
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1220]">
            Google Review Widget Generator
          </h1>
          <p className="mt-2 text-[15px] text-[#667085]">
            Choose a layout and copy embeddable HTML for your website—or a simple review badge.
          </p>
        </div>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-[12px] font-semibold text-[#344054]">
            Find your Google Business Profile
          </label>
          <div className="flex gap-2">
            <input
              className="h-11 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business name + city"
              onKeyDown={(e) => {
                if (e.key === "Enter") void searchPlaces();
              }}
            />
            <button
              type="button"
              disabled={searching || query.trim().length < 2}
              onClick={() => void searchPlaces()}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#137752] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
          {candidates.length > 0 ? (
            <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-[#E6EAF0]">
              {candidates.map((c) => (
                <li key={c.place_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className={cn(
                      "w-full border-b border-[#F2F4F7] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#F7FAF8]",
                      selected?.place_id === c.place_id && "bg-[#ECFDF3]"
                    )}
                  >
                    <span className="font-semibold text-[#0B1220]">{c.name}</span>
                    <span className="mt-0.5 block text-[12px] text-[#667085]">{c.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-[#344054]">Business name</span>
            <input
              className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Plumbing"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-[#344054]">
              Google Place ID (for review link)
            </span>
            <input
              className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              placeholder="ChIJ…"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344054]">Rating</span>
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#344054]">Review count</span>
            <input
              type="number"
              min={0}
              className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
              value={reviewCount}
              onChange={(e) => setReviewCount(Number(e.target.value))}
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-[#344054]">Layout</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {LAYOUTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLayout(item.id)}
                className={cn(
                  "rounded-xl border p-3 text-left",
                  layout === item.id
                    ? "border-[#137752] bg-[#ECFDF3]"
                    : "border-[#D0D5DD] bg-white"
                )}
              >
                <span className="block text-[13px] font-semibold text-[#0B1220]">{item.label}</span>
                <span className="mt-1 block text-[11px] text-[#667085]">{item.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {layout === "cards" ? (
          <div className="grid gap-2">
            <span className="text-[12px] font-semibold text-[#344054]">
              Optional review quotes (up to 3)
            </span>
            {[quote1, quote2, quote3].map((q, i) => (
              <textarea
                key={i}
                className="min-h-[64px] w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#137752]"
                value={q}
                onChange={(e) => {
                  const setters = [setQuote1, setQuote2, setQuote3];
                  setters[i]?.(e.target.value);
                }}
                placeholder={`Customer quote ${i + 1}`}
              />
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#027A48]">
            Live preview
          </p>
          <div
            className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4"
            dangerouslySetInnerHTML={{ __html: embedCode }}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#344054]">Embed code</p>
            <button
              type="button"
              onClick={() => void copy("embed")}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#027A48]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === "embed" ? "Copied" : "Copy HTML"}
            </button>
          </div>
          <textarea
            readOnly
            className="min-h-[140px] w-full rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-2 font-mono text-[11px] text-[#344054]"
            value={embedCode}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#344054]">Review snippet (JSON-LD)</p>
            <button
              type="button"
              onClick={() => void copy("jsonld")}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#027A48]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === "jsonld" ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            className="min-h-[120px] w-full rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-2 font-mono text-[11px] text-[#344054]"
            value={jsonLd}
          />
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-[#ECFDF3] px-3 py-2 text-[12px] text-[#144C34]">
          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Want live review sync and request campaigns?{" "}
          <Link href="/sign-up" className="font-semibold underline">
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
