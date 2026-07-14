/** Grid pin color modes — Strict uses discrete buckets; Falcon uses continuous rank gradient. */
export type GridColorMode = "strict" | "falcon";

const PENDING_HEX = "#d4d4d8";
const NOT_FOUND_HEX = "#ef4444";

/** Local Falcon–inspired anchor colors (rank 1 → 20) */
const FALCON_ANCHORS: Array<{ rank: number; hex: string }> = [
  { rank: 1, hex: "#0B7A29" },
  { rank: 2, hex: "#2C8F2B" },
  { rank: 3, hex: "#5E9F2F" },
  { rank: 4, hex: "#8DAA32" },
  { rank: 5, hex: "#B6B432" },
  { rank: 6, hex: "#D8BD31" },
  { rank: 7, hex: "#E4B52F" },
  { rank: 8, hex: "#EAA92B" },
  { rank: 9, hex: "#EE9A28" },
  { rank: 10, hex: "#F28C25" },
  { rank: 11, hex: "#F07822" },
  { rank: 12, hex: "#E86520" },
  { rank: 13, hex: "#E0551E" },
  { rank: 14, hex: "#D8481C" },
  { rank: 15, hex: "#D03C1A" },
  { rank: 16, hex: "#C83318" },
  { rank: 17, hex: "#C02B16" },
  { rank: 18, hex: "#B82414" },
  { rank: 19, hex: "#B01E12" },
  { rank: 20, hex: "#A81810" },
];

const STRICT_BUCKETS: Array<{ maxRank: number; hex: string; label: string }> = [
  { maxRank: 3, hex: "#0B7A29", label: "1–3" },
  { maxRank: 4, hex: "#8DAA32", label: "4" },
  { maxRank: 10, hex: "#D8BD31", label: "5–10" },
  { maxRank: 19, hex: "#E86520", label: "11–19" },
  { maxRank: Infinity, hex: "#DC2626", label: "20+" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Interpolate between Falcon anchor ranks (1–20). */
export function rankHexFalcon(rank: number): string {
  const r = Math.max(1, Math.min(20, rank));
  const lower = Math.floor(r);
  const upper = Math.min(20, lower + 1);
  const t = upper === lower ? 0 : r - lower;
  const a = FALCON_ANCHORS.find((x) => x.rank === lower)?.hex ?? FALCON_ANCHORS[0].hex;
  const b = FALCON_ANCHORS.find((x) => x.rank === upper)?.hex ?? FALCON_ANCHORS[FALCON_ANCHORS.length - 1].hex;
  return lerpHex(a, b, t);
}

export function rankHexStrict(rank: number): string {
  for (const bucket of STRICT_BUCKETS) {
    if (rank <= bucket.maxRank) return bucket.hex;
  }
  return STRICT_BUCKETS[STRICT_BUCKETS.length - 1].hex;
}

export function rankHex(
  rank: number | null | undefined,
  mode: GridColorMode = "falcon"
): string {
  if (rank == null) return NOT_FOUND_HEX;
  if (rank > 20) return NOT_FOUND_HEX;
  return mode === "strict" ? rankHexStrict(rank) : rankHexFalcon(rank);
}

/** Slightly lighter center for radial gradient on map pins. */
export function rankPinBackground(baseHex: string): string {
  const [r, g, b] = hexToRgb(baseHex);
  const lighten = (v: number) => Math.min(255, v + 28);
  const center = rgbToHex(lighten(r), lighten(g), lighten(b));
  return `radial-gradient(circle at 38% 32%, ${center} 0%, ${baseHex} 55%, ${rgbToHex(r * 0.82, g * 0.82, b * 0.82)} 100%)`;
}

export function rankTextColor(baseHex: string): string {
  return relativeLuminance(baseHex) > 0.42 ? "#111827" : "#ffffff";
}

export type RankPinStyle = {
  background: string;
  color: string;
  baseHex: string;
};

export function rankPinStyle(
  rank: number | null,
  mode: GridColorMode,
  options?: { pending?: boolean; failed?: boolean; notInResults?: boolean }
): RankPinStyle {
  // User-facing grid never shows a hard-fail pin — retries are normal, stay pending.
  if (options?.pending || options?.failed) {
    return { background: PENDING_HEX, color: "#52525b", baseHex: PENDING_HEX };
  }
  const baseHex = options?.notInResults ? NOT_FOUND_HEX : rankHex(rank, mode);
  return {
    baseHex,
    background: rankPinBackground(baseHex),
    color: rankTextColor(baseHex),
  };
}

export type LegendItem = { label: string; hex: string };

export function legendItems(mode: GridColorMode): LegendItem[] {
  if (mode === "strict") {
    return STRICT_BUCKETS.map((b) => ({ label: b.label, hex: b.hex }));
  }
  return [1, 3, 5, 7, 10, 15, 20, 21].map((r) => ({
    label: r > 20 ? "20+" : String(r),
    hex: r > 20 ? NOT_FOUND_HEX : rankHexFalcon(r),
  }));
}

export const GRID_COLOR_MODE_STORAGE_KEY = "grid-color-mode";
