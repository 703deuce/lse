"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { Heart, Shield, Users } from "lucide-react";
import type { PosterConfig } from "@/lib/reputation/review-requests";
import {
  normalizePosterTemplateKey,
  type PosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { cn } from "@/lib/utils";

const FORMAT_SCALE: Record<PosterConfig["format"], string> = {
  a4: "max-w-[360px]",
  a5: "max-w-[300px]",
  letter: "max-w-[340px]",
};

function darkenHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Math.max(0, parseInt(normalized.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(normalized.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(normalized.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lightenHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Math.min(255, parseInt(normalized.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(normalized.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(normalized.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function GoldStars({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#F5C518"
            d="M12 2l2.9 6.26 6.84.6-5.18 4.48 1.56 6.68L12 16.9l-6.12 3.12 1.56-6.68L2.26 8.86l6.84-.6L12 2z"
          />
        </svg>
      ))}
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function QrBlock({
  qrDataUrl,
  frameClassName,
}: {
  qrDataUrl: string | null;
  frameClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-white p-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)]", frameClassName)}>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt="Review QR code"
          className="block aspect-square h-auto w-full rounded-sm object-contain"
        />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded bg-[#F2F4F7]" />
      )}
    </div>
  );
}

function FooterPillar({
  icon: Icon,
  line1,
  line2,
  accent,
}: {
  icon: typeof Shield;
  line1: string;
  line2: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 text-center">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border-2"
        style={{ borderColor: accent, color: accent }}
      >
        <Icon className="h-3 w-3" strokeWidth={2.25} />
      </span>
      <div>
        <p className="text-[6.5px] font-semibold leading-tight text-white">{line1}</p>
        <p className="text-[6px] leading-tight text-white/75">{line2}</p>
      </div>
    </div>
  );
}

function Shell({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "grid aspect-[3/4] overflow-hidden rounded-[1.25rem] shadow-[0_20px_50px_rgba(15,23,42,0.18)] ring-1 ring-black/5",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

type LayoutProps = {
  businessName: string;
  poster: PosterConfig;
  qrDataUrl: string | null;
  brand: string;
  brandDark: string;
};

function ClassicLayout({ businessName, poster, qrDataUrl, brand, brandDark }: LayoutProps) {
  return (
    <Shell className="grid-rows-[minmax(0,1fr)_auto_auto] bg-white">
      <div
        className="relative flex min-h-0 flex-col"
        style={{
          background: `linear-gradient(165deg, ${brand} 0%, ${brandDark} 55%, ${brandDark} 100%)`,
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
          viewBox="0 0 400 400"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path fill="white" d="M0 60 C80 20 120 100 200 70 C280 40 320 120 400 80 L400 0 L0 0 Z" />
          <path fill="white" d="M0 180 C100 140 140 220 220 190 C300 160 340 240 400 210 L400 400 L0 400 Z" />
        </svg>
        <div className="relative shrink-0 px-5 pb-1 pt-5 text-center text-white">
          <GoldStars />
          <h2 className="mt-1.5 text-lg font-bold leading-tight tracking-tight drop-shadow-sm">
            {poster.title}
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-white/90">{poster.description}</p>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 py-2">
          <div className="w-[50%] max-w-[150px]">
            <QrBlock qrDataUrl={qrDataUrl} />
          </div>
        </div>
        <svg className="relative block w-full shrink-0" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
          <path fill="white" d="M0 22 C70 42 150 6 200 22 C250 38 330 10 400 26 L400 40 L0 40 Z" />
        </svg>
      </div>
      <div className="relative z-[2] -mt-1 shrink-0 bg-white px-5 pb-2 pt-0 text-center">
        <div className="mx-auto -mt-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] ring-4 ring-white">
          <GoogleLogo className="h-5 w-5" />
        </div>
        <p className="mt-1.5 text-[13px] font-bold leading-tight text-[#0B1B32]">{businessName}</p>
        {poster.showFooter ? (
          <p className="mt-0.5 text-[9px] leading-snug text-[#667085]">
            Thank you for supporting our local business.
          </p>
        ) : null}
      </div>
      {poster.showFooter ? (
        <div className="grid shrink-0 grid-cols-3 bg-[#0f172a] px-2 py-2.5">
          <FooterPillar icon={Shield} line1="Local & Trusted" line2="5-Star Service" accent={brand} />
          <FooterPillar icon={Users} line1="Customer Focused" line2="Always Here to Help" accent={brand} />
          <FooterPillar icon={Heart} line1="We Appreciate" line2="Your Support" accent={brand} />
        </div>
      ) : (
        <div className="shrink-0 pb-3" />
      )}
    </Shell>
  );
}

function ModernMinimalLayout({ businessName, poster, qrDataUrl, brand }: LayoutProps) {
  return (
    <Shell className="grid-rows-[auto_1fr_auto] border border-[#E6EAF0] bg-white">
      <div className="px-5 pt-6 text-center">
        <h2 className="text-xl font-extrabold tracking-tight text-[#0B1220]">{poster.title}</h2>
        <p className="mt-1 text-[11px] text-[#667085]">{poster.description}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[52%] max-w-[150px]">
          <QrBlock qrDataUrl={qrDataUrl} frameClassName="shadow-none ring-1 ring-[#E6EAF0]" />
        </div>
        <GoldStars />
        <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
      </div>
      <div className="px-5 pb-5">
        <div
          className="rounded-full py-2.5 text-center text-[12px] font-extrabold tracking-wide text-white"
          style={{ backgroundColor: brand }}
        >
          SCAN ME
        </div>
      </div>
    </Shell>
  );
}

function SolidGreenLayout({ businessName, poster, qrDataUrl, brand, brandDark }: LayoutProps) {
  return (
    <Shell
      className="relative grid-rows-[auto_1fr_auto] text-white"
      style={{ background: `linear-gradient(180deg, ${brand} 0%, ${brandDark} 100%)` }}
    >
      <div className="px-5 pt-7 text-center">
        <h2 className="text-lg font-extrabold uppercase leading-tight tracking-wide">{poster.title}</h2>
        <p className="mt-1 text-[12px] font-medium text-white/90">{poster.description}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[52%] max-w-[150px]">
          <QrBlock qrDataUrl={qrDataUrl} />
        </div>
        <GoldStars />
      </div>
      <div className="relative px-5 pb-6 pt-2 text-center">
        <svg className="absolute inset-x-0 -top-6 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
          <path fill="rgba(255,255,255,0.12)" d="M0 40 C80 0 320 0 400 40 L400 40 L0 40 Z" />
        </svg>
        <p className="relative text-[13px] font-bold">{businessName}</p>
        <p className="relative mt-0.5 text-[10px] text-white/80">Scan to leave a review</p>
      </div>
    </Shell>
  );
}

function ElegantBlackLayout({ businessName, poster, qrDataUrl }: LayoutProps) {
  return (
    <Shell className="grid-rows-[auto_1fr_auto] bg-[#141414] text-white">
      <div className="relative px-5 pt-6 text-center">
        <div className="mx-auto mb-3 h-px w-16 bg-[#C9A227]" />
        <h2 className="font-serif text-xl font-semibold tracking-wide text-[#F5E6C8]">
          {poster.title}
        </h2>
        <div className="mx-auto mt-3 h-px w-16 bg-[#C9A227]" />
      </div>
      <div className="flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[50%] max-w-[145px] rounded-lg border border-[#C9A227]/50 p-1">
          <QrBlock qrDataUrl={qrDataUrl} frameClassName="rounded-md shadow-none" />
        </div>
        <GoldStars />
        <p className="text-[11px] text-[#F5E6C8]/80">{poster.description}</p>
      </div>
      <div className="border-t border-[#C9A227]/30 px-5 py-4 text-center">
        <p className="text-[12px] font-semibold tracking-wide text-[#F5E6C8]">{businessName}</p>
      </div>
    </Shell>
  );
}

function FriendlyGreenLayout({ businessName, poster, qrDataUrl, brand }: LayoutProps) {
  const soft = lightenHex(brand, 190);
  return (
    <Shell className="relative grid-rows-[auto_1fr_auto] overflow-hidden bg-white">
      <div className="px-5 pt-6 text-center">
        <h2 className="text-lg font-extrabold leading-tight text-[#0B1220]">{poster.title}</h2>
        <p className="mt-1 text-[11px] text-[#667085]">{poster.description}</p>
      </div>
      <div className="relative z-[1] flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[52%] max-w-[150px]">
          <QrBlock qrDataUrl={qrDataUrl} />
        </div>
        <GoldStars />
        <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
      </div>
      <div className="relative h-16">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
          <path fill={soft} d="M0 40 C60 10 140 70 200 40 C260 10 340 60 400 30 L400 80 L0 80 Z" />
          <path fill={brand} d="M0 55 C80 30 160 80 240 50 C300 30 360 70 400 45 L400 80 L0 80 Z" />
        </svg>
      </div>
    </Shell>
  );
}

function PremiumGoldLayout({ businessName, poster, qrDataUrl }: LayoutProps) {
  return (
    <Shell className="relative grid-rows-[auto_1fr_auto] overflow-hidden bg-[#0B0B0B] text-white">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-40 rotate-12"
        style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.95), rgba(212,175,55,0.15))",
        }}
      />
      <div className="relative px-5 pt-7 text-center">
        <h2 className="text-base font-extrabold uppercase leading-snug tracking-wide text-[#F7E7A8]">
          {poster.title}
        </h2>
      </div>
      <div className="relative flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[50%] max-w-[145px]">
          <QrBlock qrDataUrl={qrDataUrl} />
        </div>
        <GoldStars />
        <p className="text-[11px] text-white/75">{poster.description}</p>
      </div>
      <div className="bg-[#D4AF37] px-5 py-3 text-center">
        <p className="text-[12px] font-extrabold tracking-wide text-[#0B0B0B]">{businessName}</p>
      </div>
    </Shell>
  );
}

function CafeCoffeeLayout({ businessName, poster, qrDataUrl, brand }: LayoutProps) {
  return (
    <Shell className="relative grid-rows-[auto_1fr_auto] overflow-hidden bg-[#F3E8D8]">
      <div className="px-5 pt-6 text-center">
        <h2 className="font-serif text-xl font-semibold italic leading-tight text-[#4A3426]">
          {poster.title}
        </h2>
        <p className="mt-1 text-[11px] text-[#7A5A45]">{poster.description}</p>
      </div>
      <div className="relative z-[1] flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[52%] max-w-[150px]">
          <QrBlock qrDataUrl={qrDataUrl} frameClassName="bg-[#FFF8F0]" />
        </div>
        <GoldStars />
        <p className="text-[12px] font-bold text-[#4A3426]">{businessName}</p>
      </div>
      <div className="relative h-20">
        <div
          className="absolute bottom-3 left-4 h-12 w-12 rounded-full opacity-80"
          style={{ background: `radial-gradient(circle at 35% 35%, ${lightenHex(brand, 40)}, ${brand})` }}
        />
        <div className="absolute bottom-2 left-10 h-10 w-8 rounded-t-full bg-[#6B4226]/70" />
        <div className="absolute bottom-0 right-0 h-10 w-full bg-gradient-to-t from-[#D9C3A5] to-transparent" />
      </div>
    </Shell>
  );
}

function ClearBlueLayout({ businessName, poster, qrDataUrl, brand }: LayoutProps) {
  const blue = brand.match(/#[0-9a-f]{6}/i) && !/^#(16A34A|137752|10b981)/i.test(brand) ? brand : "#1D4ED8";
  return (
    <Shell className="relative grid-rows-[auto_1fr_auto] overflow-hidden bg-white">
      <div className="px-5 pt-6 text-center">
        <h2 className="text-xl font-extrabold uppercase tracking-tight" style={{ color: blue }}>
          {poster.title}
        </h2>
        <p className="mt-1 text-[11px] text-[#667085]">{poster.description}</p>
      </div>
      <div className="relative z-[1] flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[52%] max-w-[150px]">
          <QrBlock qrDataUrl={qrDataUrl} />
        </div>
        <GoldStars />
        <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
      </div>
      <div className="relative h-16">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
          <path fill={lightenHex(blue, 160)} d="M0 35 C90 5 180 70 270 35 C330 15 370 45 400 28 L400 80 L0 80 Z" />
          <path fill={blue} d="M0 55 C100 25 180 85 280 50 C340 30 380 70 400 48 L400 80 L0 80 Z" />
        </svg>
      </div>
    </Shell>
  );
}

function BlackWhiteLayout({ businessName, poster, qrDataUrl }: LayoutProps) {
  return (
    <Shell className="relative overflow-hidden bg-white">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, #ffffff 0% 48%, #0B1220 48% 100%)",
        }}
      />
      <div className="relative z-[1] flex h-full flex-col px-5 py-6">
        <h2 className="text-center text-lg font-extrabold uppercase leading-tight tracking-wide text-[#0B1220]">
          {poster.title}
        </h2>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3">
          <div className="w-[52%] max-w-[150px]">
            <QrBlock qrDataUrl={qrDataUrl} />
          </div>
          <GoldStars />
        </div>
        <div className="text-center text-white">
          <p className="text-[12px] font-bold">{businessName}</p>
          <p className="mt-0.5 text-[10px] text-white/75">{poster.description}</p>
        </div>
      </div>
    </Shell>
  );
}

function RusticWoodLayout({ businessName, poster, qrDataUrl }: LayoutProps) {
  return (
    <Shell
      className="relative grid-rows-[auto_1fr_auto] overflow-hidden"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, #3E2A1F 0px, #3E2A1F 14px, #4A3426 14px, #4A3426 28px), linear-gradient(90deg, rgba(0,0,0,0.25), transparent 40%, rgba(0,0,0,0.2))",
        backgroundBlendMode: "multiply",
        backgroundColor: "#3E2A1F",
      }}
    >
      <div className="px-5 pt-7 text-center">
        <h2 className="font-serif text-2xl italic text-white drop-shadow">{poster.title}</h2>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[54%] max-w-[155px] rounded-xl bg-[#F5E6D3] p-3 shadow-lg">
          <QrBlock qrDataUrl={qrDataUrl} frameClassName="bg-white shadow-none" />
          <GoldStars className="mt-2" />
        </div>
      </div>
      <div className="px-5 pb-5 text-center text-white">
        <p className="text-[12px] font-bold">{businessName}</p>
        <p className="mt-0.5 text-[10px] text-white/80">{poster.description}</p>
      </div>
    </Shell>
  );
}

function BoldPaletteLayout({ businessName, poster, qrDataUrl, brand }: LayoutProps) {
  return (
    <Shell className="relative grid-rows-[auto_1fr_auto] overflow-hidden bg-white">
      <span className="absolute -left-6 -top-8 h-28 w-28 rounded-[40%] bg-[#F43F5E]/90" />
      <span className="absolute -right-8 top-10 h-24 w-24 rounded-full bg-[#FACC15]/90" />
      <span className="absolute -bottom-8 -left-4 h-28 w-32 rounded-[45%] bg-[#22C55E]/85" />
      <span
        className="absolute -bottom-6 -right-6 h-24 w-24 rounded-[40%]"
        style={{ backgroundColor: brand }}
      />
      <div className="relative z-[1] px-5 pt-8 text-center">
        <h2 className="text-lg font-extrabold uppercase leading-tight tracking-wide text-[#0B1220]">
          {poster.title}
        </h2>
      </div>
      <div className="relative z-[1] flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-[52%] max-w-[150px]">
          <QrBlock qrDataUrl={qrDataUrl} />
        </div>
        <GoldStars />
      </div>
      <div className="relative z-[1] px-5 pb-6 text-center">
        <p className="text-[12px] font-bold text-[#0B1220]">{businessName}</p>
        <p className="mt-0.5 text-[10px] text-[#667085]">{poster.description}</p>
      </div>
    </Shell>
  );
}

function renderTemplate(
  key: PosterTemplateKey,
  props: LayoutProps
): ReactNode {
  switch (key) {
    case "modern_minimal":
      return <ModernMinimalLayout {...props} />;
    case "solid_green":
      return <SolidGreenLayout {...props} />;
    case "elegant_black":
      return <ElegantBlackLayout {...props} />;
    case "friendly_green":
      return <FriendlyGreenLayout {...props} />;
    case "premium_gold":
      return <PremiumGoldLayout {...props} />;
    case "cafe_coffee":
      return <CafeCoffeeLayout {...props} />;
    case "clear_blue":
      return <ClearBlueLayout {...props} />;
    case "black_white":
      return <BlackWhiteLayout {...props} />;
    case "rustic_wood":
      return <RusticWoodLayout {...props} />;
    case "bold_palette":
      return <BoldPaletteLayout {...props} />;
    case "classic_poster":
    default:
      return <ClassicLayout {...props} />;
  }
}

/**
 * Printable Google Review QR poster — classic free layout + paid template variants.
 */
export const ReviewPosterPreview = forwardRef<
  HTMLDivElement,
  {
    businessName: string;
    poster: PosterConfig;
    qrDataUrl: string | null;
    /** Larger max width for SEO landing preview only — same layout as app. */
    size?: "default" | "hero";
    /** Poster template key (classic free default + Pro gallery). */
    templateKey?: string | null;
  }
>(function ReviewPosterPreview(
  { businessName, poster, qrDataUrl, size = "default", templateKey },
  ref
) {
  const brand = poster.brandColor || "#137752";
  const brandDark = darkenHex(brand, 28);
  const isHero = size === "hero";
  const key = normalizePosterTemplateKey(templateKey);

  return (
    <div
      className={cn(
        "mx-auto w-full",
        isHero ? "max-w-[min(100%,300px)]" : FORMAT_SCALE[poster.format]
      )}
    >
      <div ref={ref}>
        {renderTemplate(key, {
          businessName,
          poster,
          qrDataUrl,
          brand,
          brandDark,
        })}
      </div>
    </div>
  );
});
