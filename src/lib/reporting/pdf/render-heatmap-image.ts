import sharp from "sharp";
import type { HeatmapCell } from "@/lib/reporting/types";

/**
 * Falcon-colored rank grid PNG (not a geo map) — presentation / email asset.
 */
export async function renderHeatmapGridPng(params: {
  gridSize: number;
  cells: HeatmapCell[];
  cellPx?: number;
}): Promise<Buffer> {
  const cellPx = params.cellPx ?? (params.gridSize >= 13 ? 36 : params.gridSize >= 9 ? 48 : 64);
  const pad = 24;
  const legendH = 56;
  const width = pad * 2 + params.gridSize * cellPx;
  const height = pad * 2 + params.gridSize * cellPx + legendH;

  const byKey = new Map(params.cells.map((c) => [`${c.row}:${c.col}`, c]));
  const tiles: string[] = [];
  for (let row = 0; row < params.gridSize; row++) {
    for (let col = 0; col < params.gridSize; col++) {
      const cell = byKey.get(`${row}:${col}`);
      const color = cell?.color ?? "#ef4444";
      const textColor = cell?.textColor ?? "#ffffff";
      const label =
        cell?.rank == null || cell.rank > 20 ? "—" : String(Math.round(cell.rank));
      const x = pad + col * cellPx;
      const y = pad + row * cellPx;
      const font = cellPx >= 48 ? 18 : cellPx >= 40 ? 15 : 12;
      tiles.push(`
        <rect x="${x}" y="${y}" width="${cellPx - 2}" height="${cellPx - 2}" rx="6" fill="${color}"/>
        <text x="${x + (cellPx - 2) / 2}" y="${y + (cellPx - 2) / 2 + font * 0.35}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${font}" font-weight="700" fill="${textColor}">${label}</text>`);
    }
  }

  const legendY = height - 28;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${tiles.join("\n")}
    <text x="${pad}" y="${legendY}" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#52525b">
      Heatmap · green = better rank · red = weak / not found
    </text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
