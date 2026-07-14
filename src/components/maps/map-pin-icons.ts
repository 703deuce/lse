import { rankPinStyle, type GridColorMode } from "@/lib/maps/colors";
import { rankLabel } from "@/lib/maps/grid-metrics";

type DeltaDirection = "improved" | "declined" | "unchanged" | "missing";

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** Lighten a hex for the SVG radial highlight (CSS gradients are invalid as SVG fill). */
function lightenHex(hex: string, amount = 28): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const lighten = (v: number) => Math.min(255, v + amount).toString(16).padStart(2, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `#${lighten(r)}${lighten(g)}${lighten(b)}`;
}

function darkenHex(hex: string, factor = 0.82): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const darken = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * factor)))
      .toString(16)
      .padStart(2, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `#${darken(r)}${darken(g)}${darken(b)}`;
}

function pinSvg(opts: {
  pinSize: number;
  label: string;
  baseHex: string;
  textColor: string;
  opacity: number;
  fontSize: number;
  deltaHtml?: string;
  strokeHex?: string;
  strokeWidth?: number;
}): string {
  const { pinSize, label, baseHex, textColor, opacity, fontSize } = opts;
  const cx = pinSize / 2;
  const cy = pinSize / 2;
  const r = pinSize / 2 - (opts.strokeWidth ?? 2);
  const highlight = lightenHex(baseHex);
  const edge = darkenHex(baseHex);
  const gradId = `g${baseHex.replace("#", "")}${pinSize}`;
  const stroke = opts.strokeHex ?? "#ffffff";
  const sw = opts.strokeWidth ?? 2;
  // Escape label for SVG text content
  const safeLabel = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pinSize}" height="${pinSize}" viewBox="0 0 ${pinSize} ${pinSize}">
  <defs>
    <radialGradient id="${gradId}" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="${highlight}"/>
      <stop offset="55%" stop-color="${baseHex}"/>
      <stop offset="100%" stop-color="${edge}"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="700" fill="${textColor}" opacity="${opacity}">${safeLabel}</text>
  ${opts.deltaHtml ?? ""}
</svg>`;
}

export function cellPinIcon(
  g: typeof google,
  rank: number | null,
  colorMode: GridColorMode,
  opts: {
    pending?: boolean;
    notInResults?: boolean;
    failed?: boolean;
    faded?: boolean;
    pinSize?: number;
    deltaOverlay?: { delta: number | null; direction?: DeltaDirection };
  } = {}
): google.maps.Icon {
  const pinSize = opts.pinSize ?? 36;
  // Prefer ASCII for data-URL markers — some browsers drop fancy glyphs in SVG icons
  const label = opts.failed ? "X" : opts.pending ? "..." : opts.notInResults ? "20+" : rankLabel(rank);
  const style = rankPinStyle(rank, colorMode, {
    pending: opts.pending,
    notInResults: opts.notInResults,
    failed: opts.failed,
  });
  const fontSize = opts.failed ? 14 : label.length > 2 ? 10 : 12;
  const opacity = opts.faded ? 0.35 : 1;

  let deltaHtml = "";
  if (opts.deltaOverlay?.direction && opts.deltaOverlay.direction !== "missing") {
    const arrow =
      opts.deltaOverlay.direction === "improved"
        ? "^"
        : opts.deltaOverlay.direction === "declined"
          ? "v"
          : ".";
    const deltaColor =
      opts.deltaOverlay.direction === "improved"
        ? "#16a34a"
        : opts.deltaOverlay.direction === "declined"
          ? "#dc2626"
          : "#71717a";
    deltaHtml = `<text x="${pinSize - 5}" y="11" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="700" fill="${deltaColor}" stroke="#fff" stroke-width="2" paint-order="stroke">${arrow}</text>`;
  }

  const svg = pinSvg({
    pinSize,
    label,
    baseHex: style.baseHex,
    textColor: style.color,
    opacity,
    fontSize,
    deltaHtml,
  });

  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(pinSize, pinSize),
    anchor: new g.maps.Point(pinSize / 2, pinSize / 2),
  };
}

export function previewPinIcon(g: typeof google): google.maps.Icon {
  const size = 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#93c5fd" fill-opacity="0.35" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3"/>
</svg>`;
  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(size, size),
    anchor: new g.maps.Point(size / 2, size / 2),
  };
}

export function officePinIcon(g: typeof google): google.maps.Icon {
  const w = 32;
  const h = 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="M16 2c-6.6 0-12 5.1-12 11.4 0 8.1 12 24.6 12 24.6s12-16.5 12-24.6C28 7.1 22.6 2 16 2z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
  <circle cx="16" cy="13" r="4.5" fill="#ffffff"/>
</svg>`;
  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(w, h),
    anchor: new g.maps.Point(w / 2, h - 2),
  };
}

export function spotCheckPinIcon(
  g: typeof google,
  rank: number | null,
  colorMode: GridColorMode
): google.maps.Icon {
  const label = rank != null ? rankLabel(rank) : "20+";
  const style = rankPinStyle(rank, colorMode, { notInResults: rank == null });
  const fontSize = label.length > 2 ? 9 : 11;
  const w = 38;
  const h = 44;
  const highlight = lightenHex(style.baseHex);
  const edge = darkenHex(style.baseHex);
  const gradId = `sg${style.baseHex.replace("#", "")}`;
  const safeLabel = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="${gradId}" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="${highlight}"/>
      <stop offset="55%" stop-color="${style.baseHex}"/>
      <stop offset="100%" stop-color="${edge}"/>
    </radialGradient>
  </defs>
  <circle cx="19" cy="39" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
  <circle cx="19" cy="17" r="15" fill="url(#${gradId})" stroke="#f59e0b" stroke-width="3"/>
  <text x="19" y="17" text-anchor="middle" dy="0.35em" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="700" fill="${style.color}">${safeLabel}</text>
</svg>`;
  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(w, h),
    anchor: new g.maps.Point(w / 2, h),
  };
}
