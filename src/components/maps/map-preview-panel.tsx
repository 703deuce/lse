"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { SetupMap } from "@/components/maps/setup-map";
import { useGoogleMapsApiKey } from "@/components/maps/google-maps-key-context";
import { cn } from "@/lib/utils";

/**
 * Map preview that prefers live Google Maps, but always falls back to a
 * detailed illustrated map with a red pin so wizard screens match the mockup
 * even without an API key.
 */
export function MapPreviewPanel({
  lat,
  lng,
  label,
  businessName,
  address,
  onCenterChange,
  className,
  height = 420,
  heightClass,
}: {
  lat: number | null;
  lng: number | null;
  label?: string | null;
  businessName?: string | null;
  address?: string | null;
  onCenterChange?: (lat: number, lng: number) => void;
  className?: string;
  height?: number;
  /** Optional Tailwind height classes; when set, overrides numeric height via CSS. */
  heightClass?: string;
}) {
  const apiKey = useGoogleMapsApiKey();
  const [liveFailed, setLiveFailed] = useState(false);
  const valid =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);
  const useLive = Boolean(apiKey) && valid && !liveFailed;
  const displayLabel =
    label?.trim() ||
    businessName?.trim() ||
    address?.trim() ||
    "Google Maps pin";

  useEffect(() => {
    setLiveFailed(false);
  }, [apiKey, lat, lng]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#E6EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[#F2F4F7] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
            Map preview
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-[#101828]">
            {displayLabel}
          </p>
        </div>
        {valid ? (
          <p className="text-[11px] tabular-nums text-[#667085]">
            {lat!.toFixed(4)}, {lng!.toFixed(4)}
          </p>
        ) : null}
      </div>

      <div className={cn("relative", heightClass)} style={heightClass ? undefined : { height }}>
        {useLive ? (
          <div
            className="h-full min-h-[280px]"
            style={heightClass ? undefined : { height }}
            onErrorCapture={() => setLiveFailed(true)}
          >
            <SetupMap
              center={[lat!, lng!]}
              onCenterChange={onCenterChange}
              height={heightClass ? "100%" : `${height}px`}
            />
          </div>
        ) : (
          <IllustratedMap
            lat={valid ? lat! : 38.6582}
            lng={valid ? lng! : -77.2497}
            label={displayLabel}
            address={address}
            height={heightClass ? undefined : height}
            fill={Boolean(heightClass)}
          />
        )}
      </div>
    </div>
  );
}

function IllustratedMap({
  lat,
  lng,
  label,
  address,
  height,
  fill,
}: {
  lat: number;
  lng: number;
  label?: string | null;
  address?: string | null;
  height?: number;
  fill?: boolean;
}) {
  const seed = Math.abs(Math.round((lat + lng) * 1000)) % 7;

  return (
    <div
      className={cn("relative w-full overflow-hidden", fill && "h-full min-h-[360px]")}
      style={{
        height: fill ? undefined : height,
        background: "linear-gradient(160deg, #E8F5EE 0%, #D7E8F5 45%, #F5EFE6 100%)",
      }}
    >
      <div
        className="absolute rounded-full bg-[#B7E4C7]/55 blur-2xl"
        style={{ width: 180, height: 180, left: `${10 + seed}%`, top: "8%" }}
      />
      <div
        className="absolute rounded-full bg-[#A5C8E4]/45 blur-2xl"
        style={{ width: 220, height: 160, right: "4%", bottom: "12%" }}
      />

      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={`${10 + i * 11}%`}
            x2="100%"
            y2={`${10 + i * 11}%`}
            stroke="#FFFFFF"
            strokeWidth={i % 3 === 0 ? 3.5 : 1.75}
            opacity={0.9}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${6 + i * 13}%`}
            y1="0"
            x2={`${6 + i * 13}%`}
            y2="100%"
            stroke="#FFFFFF"
            strokeWidth={i % 2 === 0 ? 3.5 : 1.75}
            opacity={0.85}
          />
        ))}
        <line
          x1="0"
          y1="72%"
          x2="100%"
          y2="30%"
          stroke="#F8FAFC"
          strokeWidth={7}
          opacity={0.95}
        />
        {/* Park / water blobs */}
        <ellipse cx="22%" cy="58%" rx="9%" ry="7%" fill="#A8D5BA" opacity={0.55} />
        <ellipse cx="78%" cy="42%" rx="11%" ry="8%" fill="#9EC5E8" opacity={0.45} />
      </svg>

      <div className="absolute left-[16%] top-[20%] h-16 w-22 rounded-md bg-[#CFE8D8]/85 shadow-sm" />
      <div className="absolute left-[46%] top-[38%] h-20 w-28 rounded-md bg-[#D6E4F0]/90 shadow-sm" />
      <div className="absolute right-[14%] top-[16%] h-14 w-18 rounded-md bg-[#E8D9C8]/85 shadow-sm" />
      <div className="absolute bottom-[20%] left-[28%] h-12 w-32 rounded-md bg-[#C9DED2]/75 shadow-sm" />
      <div className="absolute bottom-[28%] right-[22%] h-10 w-16 rounded-md bg-[#E2E8F0]/80" />

      {/* Building blocks for denser mockup look */}
      <div className="absolute left-[62%] top-[22%] h-8 w-8 rounded-sm bg-[#CBD5E1]/90" />
      <div className="absolute left-[68%] top-[24%] h-10 w-6 rounded-sm bg-[#94A3B8]/70" />
      <div className="absolute left-[34%] top-[55%] h-7 w-14 rounded-sm bg-[#BBF7D0]/70" />

      {/* Red pin matching mockup */}
      <div className="absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-full">
        <div className="relative flex flex-col items-center drop-shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E11D48] text-white ring-[5px] ring-white">
            <MapPin className="h-6 w-6 fill-white" />
          </div>
          <div className="mt-[-3px] h-0 w-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-[#E11D48]" />
          <div className="mt-1 h-2.5 w-7 rounded-full bg-black/25 blur-[2px]" />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-white/80 bg-white/95 px-3 py-2.5 shadow-md backdrop-blur">
        <p className="text-[13px] font-semibold text-[#101828]">
          {label?.trim() || "Scan center"}
        </p>
        <p className="mt-0.5 text-[11px] text-[#667085]">
          {address?.trim()
            ? address
            : `${lat.toFixed(4)}, ${lng.toFixed(4)} · drag pin after Maps key is set`}
        </p>
      </div>
    </div>
  );
}
