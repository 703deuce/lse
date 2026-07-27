"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FreeToolField,
  FreeToolShell,
  freeToolInputClass,
  freeToolPrimaryBtnClass,
} from "@/components/tools/free-tool-shell";

type PlaceCandidate = {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  review_count?: number;
};

type LayoutId = "badge" | "bar" | "cards";

const LAYOUTS: { id: LayoutId; label: string; blurb: string }[] = [
  { id: "badge", label: "Badge", blurb: "Compact stars + rating" },
  { id: "bar", label: "Bar", blurb: "Full-width review strip" },
  { id: "cards", label: "Cards", blurb: "Up to 3 review quotes" },
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

export function ReviewWidgetGenerator({ embed = false }: { embed?: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceCandidate | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [rating, setRating] = useState(4.8);
  const [reviewCount, setReviewCount] = useState(35);
  const [layout, setLayout] = useState<LayoutId>("badge");
  const [quote1, setQuote1] = useState("");
  const [quote2, setQuote2] = useState("");
  const [quote3, setQuote3] = useState("");
  const [copied, setCopied] = useState(false);
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
        setError("No matching businesses found. Enter details manually.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function copyEmbed() {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <FreeToolShell
      embed={embed}
      title="Google Review Widget Generator"
      subtitle="Select a style, customize your reviews, and copy embed code for your website."
      steps={[
        { label: "Select a style" },
        { label: "Choose your reviews" },
        { label: "Customize widget" },
        { label: "Embed on website" },
      ]}
    >
      <div className="mb-5 flex flex-wrap items-end gap-4 rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Average rating</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl font-extrabold text-[#0B1220]">{rating.toFixed(1)}</span>
            <span className="text-[#FDB022]">★★★★★</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">Total reviews</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0B1220]">{reviewCount}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm font-semibold text-[#137752]">
          <Star className="h-4 w-4" />
          Live preview updates as you edit
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <FreeToolField label="Find your Google Business Profile">
            <div className="flex gap-2">
              <input
                className={freeToolInputClass}
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
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D0D5DD] px-3 text-sm font-bold text-[#344054] disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Find
              </button>
            </div>
          </FreeToolField>

          {candidates.length > 0 ? (
            <ul className="max-h-40 overflow-auto rounded-xl border border-[#E6EAF0]">
              {candidates.map((c) => (
                <li key={c.place_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className={cn(
                      "w-full border-b border-[#F2F4F7] px-3 py-2 text-left text-sm last:border-0 hover:bg-[#F7FAF8]",
                      selected?.place_id === c.place_id && "bg-[#ECFDF5]"
                    )}
                  >
                    <span className="font-semibold text-[#0B1220]">{c.name}</span>
                    <span className="mt-0.5 block text-[12px] text-[#667085]">{c.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FreeToolField label="Business name">
              <input className={freeToolInputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </FreeToolField>
            <FreeToolField label="Place ID">
              <input className={freeToolInputClass} value={placeId} onChange={(e) => setPlaceId(e.target.value)} placeholder="ChIJ…" />
            </FreeToolField>
            <FreeToolField label="Rating">
              <input type="number" min={1} max={5} step={0.1} className={freeToolInputClass} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
            </FreeToolField>
            <FreeToolField label="Review count">
              <input type="number" min={0} className={freeToolInputClass} value={reviewCount} onChange={(e) => setReviewCount(Number(e.target.value))} />
            </FreeToolField>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] font-bold text-[#344054]">1. Select a style</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {LAYOUTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLayout(item.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left",
                    layout === item.id ? "border-[#137752] bg-[#ECFDF5]" : "border-[#D0D5DD] bg-white"
                  )}
                >
                  <span className="block text-[13px] font-bold text-[#0B1220]">{item.label}</span>
                  <span className="mt-1 block text-[11px] text-[#667085]">{item.blurb}</span>
                </button>
              ))}
            </div>
          </div>

          {layout === "cards" ? (
            <div className="space-y-2">
              <p className="text-[12px] font-bold text-[#344054]">2. Choose your reviews (optional quotes)</p>
              {[quote1, quote2, quote3].map((q, i) => (
                <textarea
                  key={i}
                  className={cn(freeToolInputClass, "min-h-[64px] h-auto py-2")}
                  value={q}
                  onChange={(e) => {
                    const setters = [setQuote1, setQuote2, setQuote3];
                    setters[i]?.(e.target.value);
                  }}
                  placeholder={`Review quote ${i + 1}`}
                />
              ))}
            </div>
          ) : null}

          {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

          <button type="button" onClick={() => void copyEmbed()} className={cn(freeToolPrimaryBtnClass, "w-full sm:w-auto")}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied embed code" : "Generate Widget"}
          </button>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#137752]">Widget preview</p>
          <div
            className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4"
            dangerouslySetInnerHTML={{ __html: embedCode }}
          />
          <textarea
            readOnly
            className={cn(freeToolInputClass, "mt-3 min-h-[160px] h-auto py-2 font-mono text-[11px] text-[#344054]")}
            value={embedCode}
          />
        </div>
      </div>
    </FreeToolShell>
  );
}
