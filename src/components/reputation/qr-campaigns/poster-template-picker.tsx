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

function MiniThumb({
  templateKey,
  accent,
}: {
  templateKey: PosterTemplateKey;
  accent: string;
}) {
  // Tiny CSS thumbnails so the picker feels like the mockup grid without full poster renders.
  if (templateKey === "classic_poster" || templateKey === "solid_green") {
    return (
      <div className="h-full w-full" style={{ background: `linear-gradient(165deg, ${accent}, #0B4F36)` }}>
        <div className="mx-auto mt-5 h-8 w-8 rounded bg-white/95" />
      </div>
    );
  }
  if (templateKey === "modern_minimal") {
    return (
      <div className="flex h-full flex-col justify-between bg-white p-2">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded bg-[#0B1220]/80" />
        <div className="mx-auto h-8 w-8 rounded border border-[#E6EAF0] bg-white" />
        <div className="h-3 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    );
  }
  if (templateKey === "elegant_black" || templateKey === "premium_gold") {
    return (
      <div className="relative h-full overflow-hidden bg-[#141414]">
        {templateKey === "premium_gold" ? (
          <div className="absolute -right-3 -top-3 h-10 w-14 rotate-12 bg-[#D4AF37]/90" />
        ) : null}
        <div className="mx-auto mt-6 h-8 w-8 rounded border border-[#C9A227]/60 bg-white" />
        {templateKey === "premium_gold" ? (
          <div className="absolute inset-x-0 bottom-0 h-3 bg-[#D4AF37]" />
        ) : (
          <div className="mx-auto mt-3 h-px w-8 bg-[#C9A227]" />
        )}
      </div>
    );
  }
  if (templateKey === "friendly_green" || templateKey === "clear_blue") {
    return (
      <div className="relative h-full overflow-hidden bg-white">
        <div className="mx-auto mt-5 h-8 w-8 rounded border border-[#E6EAF0]" />
        <div
          className="absolute inset-x-0 bottom-0 h-6"
          style={{
            background: `linear-gradient(180deg, transparent, ${accent})`,
          }}
        />
      </div>
    );
  }
  if (templateKey === "cafe_coffee") {
    return (
      <div className="relative h-full bg-[#F3E8D8]">
        <div className="mx-auto mt-5 h-8 w-8 rounded bg-[#FFF8F0] shadow-sm" />
        <div className="absolute bottom-2 left-2 h-5 w-5 rounded-full bg-[#8B5E3C]/70" />
      </div>
    );
  }
  if (templateKey === "black_white") {
    return (
      <div
        className="h-full w-full"
        style={{ background: "linear-gradient(160deg, #fff 0 48%, #0B1220 48% 100%)" }}
      >
        <div className="mx-auto mt-8 h-8 w-8 rounded bg-white shadow" />
      </div>
    );
  }
  if (templateKey === "rustic_wood") {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #3E2A1F 0 10px, #4A3426 10px 20px)",
        }}
      >
        <div className="h-10 w-9 rounded bg-[#F5E6D3] p-1">
          <div className="h-full w-full rounded bg-white" />
        </div>
      </div>
    );
  }
  // bold_palette
  return (
    <div className="relative h-full overflow-hidden bg-white">
      <span className="absolute -left-2 -top-2 h-8 w-8 rounded-[40%] bg-[#F43F5E]" />
      <span className="absolute -right-2 top-4 h-7 w-7 rounded-full bg-[#FACC15]" />
      <span className="absolute -bottom-2 -left-1 h-8 w-9 rounded-[40%] bg-[#22C55E]" />
      <span className="absolute -bottom-2 -right-2 h-7 w-7 rounded-[40%]" style={{ backgroundColor: accent }} />
      <div className="relative mx-auto mt-8 h-8 w-8 rounded border border-[#E6EAF0] bg-white" />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                locked && "cursor-not-allowed opacity-75"
              )}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[#F9FAFB]">
                <MiniThumb templateKey={template.key} accent={template.accent} />
                {selected ? (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#137752] text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
                {locked ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
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
