import sharp from "sharp";
import { rankHex } from "@/lib/maps/colors";
import { getGoogleMapsApiKey } from "@/lib/maps/google-maps-key";
import { gridPointSpacingMeters, latLngToPixel, zoomForRadiusMeters } from "@/lib/reporting/pdf/mercator";

export type MapCellPin = {
  lat: number;
  lng: number;
  rank: number | null;
  label?: string;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function svgBubble(rank: number | null, cx: number, cy: number, r: number): string {
  const color = rankHex(rank);
  const { r: red, g, b } = hexToRgb(color);
  const text = rank == null || rank > 20 ? "—" : String(Math.round(rank));
  const fontSize = text.length > 2 ? r * 0.85 : r * 1.05;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgb(${red},${g},${b})" stroke="#fff" stroke-width="2"/>
    <text x="${cx}" y="${cy + fontSize * 0.35}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${text}</text>`;
}

/**
 * Build a high-res map PNG: Google Static Maps base + rank bubbles composited via sharp.
 */
export async function renderScanMapPng(params: {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  gridSize: number;
  pins: MapCellPin[];
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const width = params.width ?? 1280;
  const height = params.height ?? 1280;
  const zoom = zoomForRadiusMeters(params.radiusMeters, width);
  const apiKey = getGoogleMapsApiKey();

  let base: Buffer;
  if (apiKey) {
    const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
    url.searchParams.set("center", `${params.centerLat},${params.centerLng}`);
    url.searchParams.set("zoom", String(zoom));
    url.searchParams.set("size", `${Math.min(width, 640)}x${Math.min(height, 640)}`);
    url.searchParams.set("scale", "2");
    url.searchParams.set("maptype", "roadmap");
    url.searchParams.set("style", "feature:poi|visibility:off");
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) {
      throw new Error(`Google Static Maps HTTP ${res.status}`);
    }
    base = Buffer.from(await res.arrayBuffer());
    base = await sharp(base).resize(width, height, { fit: "fill" }).png().toBuffer();
  } else {
    // Fallback canvas when Maps key is missing — light grid background.
    base = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 241, g: 245, b: 249 },
      },
    })
      .png()
      .toBuffer();
  }

  const bubbleR = Math.max(10, Math.min(22, Math.floor(width / (params.gridSize * 2.8))));
  const bubbles = params.pins
    .map((pin) => {
      const { x, y } = latLngToPixel(
        pin.lat,
        pin.lng,
        params.centerLat,
        params.centerLng,
        zoom,
        width,
        height
      );
      if (x < -bubbleR || y < -bubbleR || x > width + bubbleR || y > height + bubbleR) {
        return "";
      }
      return svgBubble(pin.rank, x, y, bubbleR);
    })
    .join("\n");

  // Center marker
  const centerPx = latLngToPixel(
    params.centerLat,
    params.centerLng,
    params.centerLat,
    params.centerLng,
    zoom,
    width,
    height
  );
  const centerMark = `<circle cx="${centerPx.x}" cy="${centerPx.y}" r="7" fill="#111827" stroke="#fff" stroke-width="2"/>`;

  const spacing = Math.round(gridPointSpacingMeters(params.gridSize, params.radiusMeters));
  const legendY = height - 36;
  const legend = `
    <rect x="16" y="${legendY - 22}" width="420" height="48" rx="8" fill="rgba(255,255,255,0.92)" stroke="#e4e4e7"/>
    <text x="28" y="${legendY}" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#3f3f46">
      Rank: 1–3 · 4–10 · 11–20 · Not found · Pin spacing ~${spacing}m · Map data © Google
    </text>`;

  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${bubbles}
    ${centerMark}
    ${legend}
  </svg>`);

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
