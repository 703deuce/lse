import sharp from "sharp";
import { rankHex } from "@/lib/maps/colors";
import {
  apiKeySuffix,
  getGoogleMapsApiKey,
  getGoogleMapsApiKeySource,
} from "@/lib/maps/google-maps-key";
import { logger } from "@/lib/observability/logger";
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

async function blankMapBase(width: number, height: number): Promise<Buffer> {
  return sharp({
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

async function fetchStaticMapBase(params: {
  apiKey: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  width: number;
  height: number;
  withStyle: boolean;
}): Promise<{ ok: true; buffer: Buffer } | { ok: false; status: number; body: string }> {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${params.centerLat},${params.centerLng}`);
  url.searchParams.set("zoom", String(params.zoom));
  url.searchParams.set(
    "size",
    `${Math.min(params.width, 640)}x${Math.min(params.height, 640)}`
  );
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  if (params.withStyle) {
    url.searchParams.set("style", "feature:poi|visibility:off");
  }
  url.searchParams.set("key", params.apiKey);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(25_000),
    // Avoid sending a spoofed/odd Referer from the runtime.
    headers: { Accept: "image/*" },
    redirect: "follow",
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    return { ok: false, status: res.status, body };
  }
  const raw = Buffer.from(await res.arrayBuffer());
  const buffer = await sharp(raw)
    .resize(params.width, params.height, { fit: "fill" })
    .png()
    .toBuffer();
  return { ok: true, buffer };
}

/**
 * Build a high-res map PNG: Google Static Maps base + rank bubbles composited via sharp.
 *
 * If the browser Static Maps URL works but the worker gets 403, the worker is usually
 * using a different/malformed key — we log key source + last-4 (never the full key).
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
  const keySource = getGoogleMapsApiKeySource();

  let base: Buffer;
  if (apiKey) {
    try {
      // Match the simple browser test URL first (no style) — then try styled.
      let result = await fetchStaticMapBase({
        apiKey,
        centerLat: params.centerLat,
        centerLng: params.centerLng,
        zoom,
        width,
        height,
        withStyle: false,
      });
      if (!result.ok) {
        logger.warn("static_maps_http_retry_styled", {
          status: result.status,
          body: result.body,
          keySource,
          keySuffix: apiKeySuffix(apiKey),
        });
        result = await fetchStaticMapBase({
          apiKey,
          centerLat: params.centerLat,
          centerLng: params.centerLng,
          zoom,
          width,
          height,
          withStyle: true,
        });
      }
      if (!result.ok) {
        logger.warn("static_maps_http_fallback", {
          status: result.status,
          body: result.body,
          keySource,
          keySuffix: apiKeySuffix(apiKey),
          hint:
            "Browser Static Maps URL works but worker got 403 → compare keySuffix to the last 4 chars of Coolify MAPS on this worker service.",
        });
        base = await blankMapBase(width, height);
      } else {
        base = result.buffer;
      }
    } catch (err) {
      logger.warn("static_maps_fetch_fallback", {
        error: err instanceof Error ? err.message : String(err),
        keySource,
        keySuffix: apiKeySuffix(apiKey),
      });
      base = await blankMapBase(width, height);
    }
  } else {
    logger.warn("static_maps_missing_key", {
      keySource,
      hint: "No MAPS / GOOGLE_MAPS_STATIC_API_KEY visible to this worker process",
    });
    base = await blankMapBase(width, height);
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
