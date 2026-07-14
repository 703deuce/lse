import { rankPinStyle, type GridColorMode } from "@/lib/maps/colors";
import { rankLabel } from "@/lib/maps/grid-metrics";

type DeltaDirection = "improved" | "declined" | "unchanged" | "missing";

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
  const label = opts.failed ? "✕" : opts.pending ? "…" : opts.notInResults ? "20+" : rankLabel(rank);
  const style = rankPinStyle(rank, colorMode, {
    pending: opts.pending,
    notInResults: opts.notInResults,
    failed: opts.failed,
  });
  const bg = opts.pending || opts.failed || opts.notInResults ? style.baseHex : style.background;
  const fontSize = opts.failed ? 14 : label.length > 2 ? 10 : 12;
  const opacity = opts.faded ? 0.35 : 1;

  let delta = "";
  if (opts.deltaOverlay?.direction && opts.deltaOverlay.direction !== "missing") {
    const arrow =
      opts.deltaOverlay.direction === "improved"
        ? "▲"
        : opts.deltaOverlay.direction === "declined"
          ? "▼"
          : "•";
    const deltaColor =
      opts.deltaOverlay.direction === "improved"
        ? "#16a34a"
        : opts.deltaOverlay.direction === "declined"
          ? "#dc2626"
          : "#71717a";
    delta = `<text x="${pinSize - 4}" y="10" text-anchor="end" font-size="9" font-weight="700" fill="${deltaColor}" stroke="#fff" stroke-width="2" paint-order="stroke">${arrow}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pinSize}" height="${pinSize}" viewBox="0 0 ${pinSize} ${pinSize}">
    <circle cx="${pinSize / 2}" cy="${pinSize / 2}" r="${pinSize / 2 - 2}" fill="${bg}" stroke="#fff" stroke-width="2" opacity="${opacity}"/>
    <text x="${pinSize / 2}" y="${pinSize / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="${style.color}" opacity="${opacity}">${label}</text>
    ${delta}
  </svg>`;

  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(pinSize, pinSize),
    anchor: new g.maps.Point(pinSize / 2, pinSize / 2),
  };
}

export function previewPinIcon(g: typeof google): google.maps.Icon {
  const size = 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="rgba(37,99,235,0.25)" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3"/>
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
    <path d="M16 2c-6.6 0-12 5.1-12 11.4 0 8.1 12 24.6 12 24.6s12-16.5 12-24.6C28 7.1 22.6 2 16 2z" fill="#2563eb" stroke="#fff" stroke-width="2"/>
    <circle cx="16" cy="13" r="4.5" fill="#fff"/>
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <circle cx="19" cy="39" r="5" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
    <circle cx="19" cy="17" r="15" fill="${style.background}" stroke="#f59e0b" stroke-width="3"/>
    <text x="19" y="18" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="${style.color}">${label}</text>
  </svg>`;
  return {
    url: svgUrl(svg),
    scaledSize: new g.maps.Size(w, h),
    anchor: new g.maps.Point(w / 2, h),
  };
}
