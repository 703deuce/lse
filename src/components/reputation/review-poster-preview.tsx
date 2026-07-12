"use client";

import { forwardRef } from "react";
import { Heart, Shield, Users } from "lucide-react";
import type { PosterConfig } from "@/lib/reputation/review-requests";

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

function GoldStars() {
  return (
    <div className="flex items-center justify-center gap-0.5">
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

export const ReviewPosterPreview = forwardRef<
  HTMLDivElement,
  {
    businessName: string;
    poster: PosterConfig;
    qrDataUrl: string | null;
  }
>(function ReviewPosterPreview({ businessName, poster, qrDataUrl }, ref) {
  const brand = poster.brandColor;
  const brandDark = darkenHex(brand, 28);

  return (
    <div className={`mx-auto w-full ${FORMAT_SCALE[poster.format]}`}>
      <div
        ref={ref}
        className="grid aspect-[3/4] grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden rounded-[1.25rem] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] ring-1 ring-black/5"
      >
        {/* Row 1 — green header + QR (contained, no overlap) */}
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
            <div className="w-[50%] max-w-[150px] rounded-xl bg-white p-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Review QR code"
                  className="block aspect-square h-auto w-full rounded-sm object-contain"
                />
              ) : (
                <div className="aspect-square w-full animate-pulse rounded bg-surface-subtle" />
              )}
            </div>
          </div>

          {/* Wave at bottom of green row */}
          <svg
            className="relative block w-full shrink-0"
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path fill="white" d="M0 22 C70 42 150 6 200 22 C250 38 330 10 400 26 L400 40 L0 40 Z" />
          </svg>
        </div>

        {/* Row 2 — business info on white */}
        <div className="relative z-[2] -mt-1 shrink-0 bg-white px-5 pb-2 pt-0 text-center">
          <div className="mx-auto -mt-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] ring-4 ring-white">
            <GoogleLogo className="h-5 w-5" />
          </div>
          <p className="mt-1.5 text-[13px] font-bold leading-tight text-text">{businessName}</p>
          {poster.showFooter && (
            <p className="mt-0.5 text-[9px] leading-snug text-text-muted">
              Thank you for supporting our local business.
            </p>
          )}
        </div>

        {/* Row 3 — dark footer */}
        {poster.showFooter ? (
          <div className="grid shrink-0 grid-cols-3 bg-[#0f172a] px-2 py-2.5">
            <FooterPillar
              icon={Shield}
              line1="Local & Trusted"
              line2="5-Star Service"
              accent={brand}
            />
            <FooterPillar
              icon={Users}
              line1="Customer Focused"
              line2="Always Here to Help"
              accent={brand}
            />
            <FooterPillar
              icon={Heart}
              line1="We Appreciate"
              line2="Your Support"
              accent={brand}
            />
          </div>
        ) : (
          <div className="shrink-0 pb-3" />
        )}
      </div>
    </div>
  );
});
