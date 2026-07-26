"use client";

import { forwardRef } from "react";
import type { PosterConfig } from "@/lib/reputation/review-requests";
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

function GoldStars({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={cls} aria-hidden>
          <path
            fill="#F5C518"
            d="M12 2l2.9 6.26 6.84.6-5.18 4.48 1.56 6.68L12 16.9l-6.12 3.12 1.56-6.68L2.26 8.86l6.84-.6L12 2z"
          />
        </svg>
      ))}
    </div>
  );
}

/**
 * Printable Google Review QR poster — mockup style:
 * green wave header/footer, white QR stage, business name, LSE branding.
 */
export const ReviewPosterPreview = forwardRef<
  HTMLDivElement,
  {
    businessName: string;
    poster: PosterConfig;
    qrDataUrl: string | null;
    /** `hero` uses a larger footprint for the SEO landing preview column. */
    size?: "default" | "hero";
  }
>(function ReviewPosterPreview({ businessName, poster, qrDataUrl, size = "default" }, ref) {
  const brand = poster.brandColor || "#16A34A";
  const brandDark = darkenHex(brand, 32);
  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "mx-auto",
        // 88% of the absolute stage keeps breathing room without looking tiny
        isHero ? "h-[88%] w-auto max-w-full" : cn("w-full", FORMAT_SCALE[poster.format])
      )}
    >
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden bg-white ring-1 ring-black/5",
          isHero
            ? "aspect-[3/4] h-full w-auto rounded-[1.75rem] shadow-[0_28px_70px_rgba(11,27,50,0.16)]"
            : "aspect-[3/4] w-full rounded-[1.5rem] shadow-[0_24px_60px_rgba(11,27,50,0.18)]"
        )}
      >
        {/* Top brand field */}
        <div
          className="absolute inset-x-0 top-0 h-[42%]"
          style={{
            background: `linear-gradient(160deg, ${brand} 0%, ${brandDark} 100%)`,
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full opacity-20"
            viewBox="0 0 400 280"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              fill="white"
              d="M0 40 C90 0 140 80 220 40 C300 0 340 70 400 30 L400 0 L0 0 Z"
            />
            <path
              fill="white"
              d="M0 180 C80 140 160 210 240 170 C320 130 360 200 400 160 L400 280 L0 280 Z"
            />
          </svg>
          <div
            className={cn(
              "relative text-center text-white",
              isHero ? "px-8 pb-12 pt-9" : "px-6 pb-10 pt-7"
            )}
          >
            <GoldStars size={isHero ? "md" : "md"} />
            <h2
              className={cn(
                "font-extrabold uppercase leading-tight tracking-[0.02em] drop-shadow-sm",
                isHero ? "mt-4 text-[1.65rem]" : "mt-3 text-[1.35rem]"
              )}
            >
              {poster.title || "Leave us a review!"}
            </h2>
            <p
              className={cn(
                "font-medium text-white/90",
                isHero ? "mt-2 text-[14px]" : "mt-1.5 text-[12px]"
              )}
            >
              {poster.description || "Scan with your phone camera"}
            </p>
          </div>
        </div>

        {/* Wave into white QR stage */}
        <svg
          className="absolute left-0 right-0 top-[38%] z-10 w-full"
          viewBox="0 0 400 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path fill="white" d="M0 18 C80 48 150 0 200 20 C260 42 330 4 400 24 L400 48 L0 48 Z" />
        </svg>

        {/* Center QR */}
        <div
          className={cn(
            "absolute inset-x-0 top-[44%] z-20 flex justify-center",
            isHero ? "px-10" : "px-8"
          )}
        >
          <div
            className={cn(
              "rounded-2xl bg-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] ring-1 ring-black/5",
              isHero ? "w-[56%] max-w-[220px] p-4" : "w-[54%] max-w-[168px] p-3"
            )}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Review QR code"
                className="block aspect-square h-auto w-full rounded-md object-contain"
              />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-md bg-[#F2F4F7]" />
            )}
          </div>
        </div>

        {/* Bottom copy */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex h-[34%] flex-col items-center justify-end text-center",
            isHero ? "px-8 pb-6" : "px-6 pb-5"
          )}
        >
          <p
            className={cn(
              "font-extrabold uppercase tracking-[0.04em] text-[#0B1B32]",
              isHero ? "text-[17px]" : "text-[15px]"
            )}
          >
            {businessName || "Your Business"}
          </p>
          {poster.showFooter ? (
            <p
              className={cn(
                "leading-snug text-[#667085]",
                isHero ? "mt-1.5 max-w-[260px] text-[11px]" : "mt-1 max-w-[220px] text-[10px]"
              )}
            >
              Thank you for supporting our local business.
            </p>
          ) : null}
          <div
            className={cn(
              "w-full font-semibold uppercase tracking-[0.12em] text-white",
              isHero
                ? "mt-4 rounded-xl px-3 py-2.5 text-[10px]"
                : "mt-3 rounded-xl px-3 py-2 text-[9px]"
            )}
            style={{ background: brandDark }}
          >
            Powered by Local SEO Express
          </div>
        </div>
      </div>
    </div>
  );
});
