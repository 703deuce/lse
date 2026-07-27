"use client";

import Link from "next/link";
import { Check, Lock, Palette, Image as ImageIcon, Type, Printer, LayoutTemplate } from "lucide-react";
import {
  POSTER_TEMPLATES,
  type PosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { cn } from "@/lib/utils";

const FEATURE_CHIPS = [
  { icon: Palette, label: "Choose Colors" },
  { icon: ImageIcon, label: "Add Your Logo" },
  { icon: Type, label: "Custom Message" },
  { icon: Printer, label: "High Quality" },
  { icon: LayoutTemplate, label: "Multiple Sizes" },
] as const;

/** Readable mini QR for ~200px-wide thumbs (not a CSS-shrunk full poster). */
function MiniQr({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[4px] bg-white p-[3px] shadow-sm ring-1 ring-black/10", className)}>
      <svg viewBox="0 0 42 42" className="block h-full w-full" aria-hidden>
        <rect width="42" height="42" fill="#fff" />
        <g fill="#0B1B32">
          <rect x="3" y="3" width="12" height="12" />
          <rect x="6" y="6" width="6" height="6" fill="#fff" />
          <rect x="27" y="3" width="12" height="12" />
          <rect x="30" y="6" width="6" height="6" fill="#fff" />
          <rect x="3" y="27" width="12" height="12" />
          <rect x="6" y="30" width="6" height="6" fill="#fff" />
          <rect x="18" y="18" width="4" height="4" />
          <rect x="24" y="18" width="4" height="4" />
          <rect x="18" y="24" width="4" height="4" />
          <rect x="28" y="24" width="6" height="4" />
          <rect x="24" y="30" width="4" height="6" />
          <rect x="34" y="28" width="4" height="4" />
          <rect x="34" y="34" width="4" height="4" />
        </g>
      </svg>
    </div>
  );
}

function MiniStars({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cn("text-[9px] leading-none", light ? "text-[#F5C518]" : "text-[#F5C518]")}>
          ★
        </span>
      ))}
    </div>
  );
}

/**
 * Purpose-built gallery thumbnails — readable at card size.
 * Visual identity matches each ReviewPosterPreview layout without CSS-scaling a full poster.
 */
function TemplateThumb({
  templateKey,
  accent,
  title,
}: {
  templateKey: PosterTemplateKey;
  accent: string;
  title: string;
}) {
  const shortTitle = title.length > 28 ? `${title.slice(0, 26)}…` : title;

  if (templateKey === "modern_minimal") {
    return (
      <div className="flex h-full flex-col bg-white px-2.5 pb-2.5 pt-3">
        <p className="text-center text-[10px] font-extrabold leading-tight text-[#0B1220]">{shortTitle}</p>
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-1.5">
          <MiniQr className="h-[42%] max-h-[72px] w-[42%]" />
          <MiniStars />
          <p className="text-[8px] font-bold text-[#0B1220]">Your Business</p>
        </div>
        <div
          className="mt-auto rounded-full py-1 text-center text-[8px] font-extrabold tracking-wide text-white"
          style={{ backgroundColor: accent }}
        >
          SCAN ME
        </div>
      </div>
    );
  }

  if (templateKey === "solid_green") {
    return (
      <div
        className="flex h-full flex-col px-2.5 py-3 text-white"
        style={{ background: `linear-gradient(180deg, ${accent} 0%, #0d5c3d 100%)` }}
      >
        <p className="text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide">{shortTitle}</p>
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
          <MiniQr className="h-[44%] max-h-[76px] w-[44%]" />
          <MiniStars light />
        </div>
        <p className="text-center text-[9px] font-bold">Your Business</p>
        <p className="text-center text-[7px] text-white/80">Scan to leave a review</p>
      </div>
    );
  }

  if (templateKey === "elegant_black") {
    return (
      <div className="flex h-full flex-col bg-[#141414] px-2.5 py-3 text-white">
        <div className="mx-auto mb-1.5 h-px w-10 bg-[#C9A227]" />
        <p className="text-center font-serif text-[10px] font-semibold leading-tight text-[#F5E6C8]">{shortTitle}</p>
        <div className="mx-auto mt-1.5 h-px w-10 bg-[#C9A227]" />
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
          <div className="rounded border border-[#C9A227]/50 p-0.5">
            <MiniQr className="h-[40%] max-h-[70px] w-[70px]" />
          </div>
          <MiniStars light />
        </div>
        <p className="border-t border-[#C9A227]/30 pt-1.5 text-center text-[8px] font-semibold tracking-wide text-[#F5E6C8]">
          Your Business
        </p>
      </div>
    );
  }

  if (templateKey === "friendly_green") {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-white px-2.5 pt-3">
        <p className="text-center text-[10px] font-extrabold leading-tight text-[#0B1220]">{shortTitle}</p>
        <div className="relative z-[1] mt-2 flex flex-1 flex-col items-center justify-center gap-1">
          <MiniQr className="h-[42%] max-h-[72px] w-[42%]" />
          <MiniStars />
          <p className="text-[8px] font-bold text-[#0B1220]">Your Business</p>
        </div>
        <svg className="relative mt-auto h-10 w-full" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden>
          <path fill="#D1FAE5" d="M0 20 C30 5 70 35 100 20 C130 5 170 30 200 15 L200 40 L0 40 Z" />
          <path fill={accent} d="M0 28 C40 15 80 40 120 25 C150 15 180 35 200 22 L200 40 L0 40 Z" />
        </svg>
      </div>
    );
  }

  if (templateKey === "premium_gold") {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-[#0B0B0B] px-2.5 pt-3 text-white">
        <div
          className="pointer-events-none absolute -right-4 -top-4 h-14 w-20 rotate-12"
          style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.95), rgba(212,175,55,0.15))" }}
        />
        <p className="relative text-center text-[9px] font-extrabold uppercase leading-snug tracking-wide text-[#F7E7A8]">
          {shortTitle}
        </p>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-1.5">
          <MiniQr className="h-[42%] max-h-[72px] w-[42%]" />
          <MiniStars light />
        </div>
        <div className="relative bg-[#D4AF37] px-2 py-1.5 text-center">
          <p className="text-[8px] font-extrabold tracking-wide text-[#0B0B0B]">Your Business</p>
        </div>
      </div>
    );
  }

  if (templateKey === "cafe_coffee") {
    return (
      <div className="flex h-full flex-col bg-[#F3E8D8] px-2.5 pt-3">
        <p className="text-center font-serif text-[10px] font-semibold italic leading-tight text-[#4A3426]">
          {shortTitle}
        </p>
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-1">
          <MiniQr className="h-[42%] max-h-[72px] w-[42%]" />
          <MiniStars />
          <p className="text-[8px] font-bold text-[#4A3426]">Your Business</p>
        </div>
        <div className="relative mt-auto h-8">
          <div className="absolute bottom-1 left-2 h-6 w-6 rounded-full bg-[#8B5E3C]/85" />
          <div className="absolute bottom-0 left-5 h-5 w-4 rounded-t-full bg-[#6B4226]/70" />
        </div>
      </div>
    );
  }

  if (templateKey === "clear_blue") {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-white px-2.5 pt-3">
        <p className="text-center text-[10px] font-extrabold uppercase tracking-tight text-[#1D4ED8]">{shortTitle}</p>
        <div className="relative z-[1] mt-2 flex flex-1 flex-col items-center justify-center gap-1">
          <MiniQr className="h-[42%] max-h-[72px] w-[42%]" />
          <MiniStars />
          <p className="text-[8px] font-bold text-[#0B1220]">Your Business</p>
        </div>
        <svg className="relative mt-auto h-10 w-full" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden>
          <path fill="#BFDBFE" d="M0 18 C45 2 90 35 135 18 C165 8 185 22 200 14 L200 40 L0 40 Z" />
          <path fill="#1D4ED8" d="M0 28 C50 12 90 42 140 25 C170 15 190 35 200 24 L200 40 L0 40 Z" />
        </svg>
      </div>
    );
  }

  if (templateKey === "black_white") {
    return (
      <div className="relative flex h-full flex-col overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(160deg, #ffffff 0% 48%, #0B1220 48% 100%)" }}
        />
        <div className="relative z-[1] flex h-full flex-col px-2.5 py-3">
          <p className="text-center text-[9px] font-extrabold uppercase leading-tight tracking-wide text-[#0B1220]">
            {shortTitle}
          </p>
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <MiniQr className="h-[40%] max-h-[68px] w-[40%]" />
            <MiniStars />
          </div>
          <p className="text-center text-[8px] font-bold text-white">Your Business</p>
        </div>
      </div>
    );
  }

  if (templateKey === "rustic_wood") {
    return (
      <div
        className="flex h-full flex-col px-2.5 py-3 text-white"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #3E2A1F 0px, #3E2A1F 10px, #4A3426 10px, #4A3426 20px)",
          backgroundColor: "#3E2A1F",
        }}
      >
        <p className="text-center font-serif text-[11px] italic drop-shadow">{shortTitle}</p>
        <div className="mt-2 flex flex-1 flex-col items-center justify-center">
          <div className="rounded-lg bg-[#F5E6D3] p-1.5 shadow">
            <MiniQr className="h-[48px] w-[48px]" />
            <MiniStars />
          </div>
        </div>
        <p className="text-center text-[8px] font-bold">Your Business</p>
      </div>
    );
  }

  if (templateKey === "bold_palette") {
    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-white px-2.5 pt-3">
        <span className="absolute -left-3 -top-4 h-14 w-14 rounded-[40%] bg-[#F43F5E]/90" />
        <span className="absolute -right-4 top-6 h-12 w-12 rounded-full bg-[#FACC15]/90" />
        <span className="absolute -bottom-4 -left-2 h-14 w-16 rounded-[45%] bg-[#22C55E]/85" />
        <span className="absolute -bottom-3 -right-3 h-12 w-12 rounded-[40%]" style={{ backgroundColor: accent }} />
        <p className="relative z-[1] text-center text-[9px] font-extrabold uppercase leading-tight tracking-wide text-[#0B1220]">
          {shortTitle}
        </p>
        <div className="relative z-[1] mt-2 flex flex-1 flex-col items-center justify-center gap-1">
          <MiniQr className="h-[42%] max-h-[72px] w-[42%]" />
          <MiniStars />
        </div>
        <p className="relative z-[1] pb-2.5 text-center text-[8px] font-bold text-[#0B1220]">Your Business</p>
      </div>
    );
  }

  // classic_poster (default free)
  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div
        className="flex flex-1 flex-col px-2.5 pb-2 pt-2.5 text-white"
        style={{ background: `linear-gradient(165deg, ${accent} 0%, #0d5c3d 100%)` }}
      >
        <MiniStars light />
        <p className="mt-1 text-center text-[10px] font-bold leading-tight">{shortTitle}</p>
        <div className="mt-2 flex flex-1 items-center justify-center">
          <MiniQr className="h-[48%] max-h-[78px] w-[48%]" />
        </div>
      </div>
      <div className="bg-white px-2 py-1.5 text-center">
        <p className="text-[9px] font-bold text-[#0B1B32]">Your Business</p>
        <p className="text-[7px] text-[#667085]">Thank you for your support</p>
      </div>
    </div>
  );
}

export function PosterTemplatePicker({
  value,
  onChange,
  canUsePremium,
  upgradeHref,
  className,
}: {
  value: PosterTemplateKey;
  onChange: (key: PosterTemplateKey, meta: { suggestedTitle: string; suggestedDescription: string }) => void;
  canUsePremium: boolean;
  upgradeHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[#0B1220]">Choose Your QR Poster Template</h3>
            <span className="rounded-full bg-[#137752] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
              Pro
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[#667085]">
            Start with your default poster, then switch templates anytime — same as switching print size.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {POSTER_TEMPLATES.map((template) => {
          const selected = value === template.key;
          const locked = template.premium && !canUsePremium;
          return (
            <button
              key={template.key}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onChange(template.key, {
                  suggestedTitle: template.suggestedTitle,
                  suggestedDescription: template.suggestedDescription,
                });
              }}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-white text-left transition",
                selected
                  ? "border-[#137752] ring-2 ring-[#137752]/25"
                  : "border-[#E6EAF0] hover:border-[#137752]/50",
                locked && "cursor-not-allowed opacity-80"
              )}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[#F3F5F7]">
                <TemplateThumb
                  templateKey={template.key}
                  accent={template.accent}
                  title={template.suggestedTitle}
                />
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#137752] text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
                {locked ? (
                  <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-[#0B1220]">
                      <Lock className="h-3 w-3" /> Pro
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="border-t border-[#F2F4F7] px-2.5 py-2">
                <p className="truncate text-[11px] font-extrabold text-[#0B1220]">{template.label}</p>
                <p className="truncate text-[10px] text-[#667085]">{template.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#667085]">
        {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-[#137752]" />
            {label}
          </span>
        ))}
      </div>

      {!canUsePremium && upgradeHref ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#137752] px-4 py-3 text-white">
          <div>
            <p className="text-sm font-extrabold">Unlock All Templates</p>
            <p className="text-[12px] text-white/85">
              Get access to all templates, custom branding, and premium features.
            </p>
          </div>
          <Link
            href={upgradeHref}
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-extrabold text-[#137752]"
          >
            Upgrade Now
          </Link>
        </div>
      ) : null}
    </div>
  );
}
