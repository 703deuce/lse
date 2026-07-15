import { escapeHtml } from "@/lib/reporting/metrics";
import { rankLabel } from "@/lib/maps/grid-metrics";
import type {
  AnyReportPayload,
  CompetitorReportPayload,
  HeatmapCell,
  KeywordReportPayload,
  LocationReportPayload,
  MapsCampaignReportPayload,
  ReportCompetitorRow,
  ReportKpis,
  ReviewCampaignReportPayload,
  ReviewsReportPayload,
  SingleScanReportPayload,
  TrendReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

function accent(wl: WhiteLabelConfig): string {
  return wl.accentColor?.trim() || "#059669";
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function reportTitle(type: AnyReportPayload["reportType"]): string {
  switch (type) {
    case "single_scan":
      return "Single Scan Report";
    case "trend":
      return "Trend Report";
    case "competitor":
      return "Competitor Report";
    case "location":
      return "Location Report";
    case "keyword":
      return "Keyword Report";
    case "maps_campaign":
      return "Maps Campaign Report";
    case "reviews":
      return "Reviews Report";
    case "review_campaign":
      return "Review Campaign Report";
    default:
      return "Maps Report";
  }
}

function periodLabel(payload: AnyReportPayload): string {
  if (payload.reportType === "single_scan" || payload.reportType === "competitor") {
    return payload.parameters.scannedAt;
  }
  if (
    payload.reportType === "trend" ||
    payload.reportType === "location" ||
    payload.reportType === "keyword" ||
    payload.reportType === "maps_campaign"
  ) {
    return `${payload.parameters.dateFrom} → ${payload.parameters.dateTo}`;
  }
  if (payload.reportType === "reviews") {
    return payload.parameters.auditedAt ?? "";
  }
  if (payload.reportType === "review_campaign") {
    return payload.parameters.campaignName;
  }
  return "";
}

function simpleKpiRow(items: Array<{ label: string; value: string }>): string {
  return `<div class="kpi-row">${items
    .map(
      (i) =>
        `<div class="kpi"><span class="kpi-label">${escapeHtml(i.label)}</span><span class="kpi-value">${escapeHtml(i.value)}</span></div>`
    )
    .join("")}</div>`;
}

function kpiCards(kpis: ReportKpis): string {
  const items: Array<{ label: string; value: string }> = [
    { label: "ARP", value: fmt(kpis.arp) },
    { label: "ATRP", value: fmt(kpis.atrp) },
    { label: "SoLV", value: `${fmt(kpis.solv)}%` },
    { label: "Top 3", value: `${fmt(kpis.top3Pct)}%` },
    { label: "Top 10", value: `${fmt(kpis.top10Pct)}%` },
    { label: "Visibility", value: `${fmt(kpis.visibilityScore, 0)}` },
    { label: "Best", value: fmt(kpis.bestRank, 0) },
    { label: "Found", value: `${kpis.foundCells}/${kpis.totalCells}` },
  ];
  return simpleKpiRow(items);
}

/** Rollup reports only have honest ARP/ATRP/SoLV averages — not cell-level coverage. */
function rollupKpiCards(kpis: ReportKpis, unitLabel: string): string {
  return simpleKpiRow([
    { label: "Avg ARP", value: fmt(kpis.arp) },
    { label: "Avg ATRP", value: fmt(kpis.atrp) },
    { label: "Avg SoLV", value: `${fmt(kpis.solv)}%` },
    { label: unitLabel, value: `${kpis.foundCells}/${kpis.totalCells}` },
  ]);
}

function heatmapHtml(gridSize: number, cells: HeatmapCell[]): string {
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  const tiles = sorted
    .map((c) => {
      const label = rankLabel(c.rank);
      return `<div class="heat-cell" style="background:${escapeHtml(c.color)};color:${escapeHtml(c.textColor)}" title="${escapeHtml(c.label)}: ${escapeHtml(label)}"><span class="heat-rank">${escapeHtml(label)}</span><span class="heat-label">${escapeHtml(c.label)}</span></div>`;
    })
    .join("");
  return `<div class="heatmap" style="grid-template-columns:repeat(${Math.max(1, gridSize)},minmax(0,1fr))">${tiles}</div>`;
}

function competitorTable(
  rows: ReportCompetitorRow[],
  options?: { selectedKeys?: string[]; highlightSelected?: boolean }
): string {
  const selected = new Set(options?.selectedKeys ?? []);
  const body = rows
    .map((c) => {
      const isSel = options?.highlightSelected && (c.isTarget || selected.has(c.key));
      return `<tr class="${c.isTarget ? "is-target" : ""}${isSel ? " is-selected" : ""}">
      <td>${escapeHtml(c.name)}${c.isTarget ? ' <span class="badge">You</span>' : ""}</td>
      <td>${escapeHtml(fmt(c.arp))}</td>
      <td>${escapeHtml(fmt(c.atrp))}</td>
      <td>${escapeHtml(fmt(c.solv))}%</td>
      <td>${c.top3Appearances}</td>
      <td>${escapeHtml(fmt(c.appearancePct))}%</td>
      <td>${c.rating != null ? escapeHtml(String(c.rating)) : "—"}</td>
      <td>${c.reviewCount != null ? escapeHtml(String(c.reviewCount)) : "—"}</td>
    </tr>`;
    })
    .join("");
  return `<table class="data">
    <thead><tr><th>Business</th><th>ARP</th><th>ATRP</th><th>SoLV</th><th>Top-3</th><th>Appear %</th><th>Rating</th><th>Reviews</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function trendChartSvg(series: TrendReportPayload["series"]): string {
  const w = 720;
  const h = 220;
  const pad = 36;
  if (series.length < 2) {
    return `<p class="muted">Not enough points to chart.</p>`;
  }

  const arps = series.map((s) => s.arp).filter((n): n is number => n != null);
  const solvs = series.map((s) => s.solv).filter((n): n is number => n != null);
  const minArp = Math.min(...(arps.length ? arps : [1]), 1);
  const maxArp = Math.max(...(arps.length ? arps : [20]), 21);
  const maxSolv = Math.max(100, ...(solvs.length ? solvs : [100]));

  const xAt = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
  const yArp = (v: number) => pad + ((v - minArp) / Math.max(0.01, maxArp - minArp)) * (h - pad * 2);
  const ySolv = (v: number) => h - pad - (v / maxSolv) * (h - pad * 2);

  const arpPts = series
    .map((s, i) => (s.arp == null ? null : `${xAt(i).toFixed(1)},${yArp(s.arp).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const solvPts = series
    .map((s, i) => (s.solv == null ? null : `${xAt(i).toFixed(1)},${ySolv(s.solv).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend chart">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#f8fafc"/>
    <polyline fill="none" stroke="#059669" stroke-width="2.5" points="${arpPts}"/>
    <polyline fill="none" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="4 3" points="${solvPts}"/>
    <text x="${pad}" y="16" font-size="11" fill="#059669">ARP (lower better)</text>
    <text x="${w - 140}" y="16" font-size="11" fill="#0ea5e9">SoLV %</text>
  </svg>`;
}

function shell(
  payload: AnyReportPayload,
  body: string
): string {
  const wl = payload.whiteLabel;
  const color = accent(wl);
  const bizName =
    "name" in payload.business ? payload.business.name : "Business";
  const footerBits = [
    wl.footerText?.trim() || null,
    wl.hidePlatformBranding ? null : "Generated by Maps Growth Agent",
    wl.contactLine?.trim() || null,
    `Generated ${payload.generatedAt}`,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(reportTitle(payload.reportType))} — ${escapeHtml(bizName)}</title>
  <style>
    :root { --accent: ${escapeHtml(color)}; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --bg: #ffffff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: var(--ink); background: linear-gradient(180deg,#f8fafc 0%,#fff 240px); }
    .wrap { max-width: 960px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
    header.report-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; border-bottom: 2px solid var(--accent); padding-bottom: 0.85rem; margin-bottom: 1.25rem; }
    .brand { display: flex; gap: 0.75rem; align-items: center; }
    .brand img { max-height: 40px; max-width: 140px; object-fit: contain; }
    .brand-name { font-size: 1.35rem; font-weight: 750; letter-spacing: -0.02em; color: var(--accent); }
    .meta { text-align: right; font-size: 0.8rem; color: var(--muted); line-height: 1.45; }
    .meta strong { color: var(--ink); font-weight: 650; }
    h1 { font-size: 1.15rem; margin: 0 0 0.25rem; }
    h2 { font-size: 0.95rem; margin: 1.4rem 0 0.55rem; color: var(--ink); }
    .muted { color: var(--muted); font-size: 0.85rem; }
    .print-bar { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
    .print-bar button { background: var(--accent); color: #fff; border: 0; border-radius: 6px; padding: 0.45rem 0.85rem; font-size: 0.8rem; cursor: pointer; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.5rem; margin: 0.75rem 0 1rem; }
    .kpi { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 0.45rem 0.65rem; display: flex; flex-direction: column; min-height: 58px; }
    .kpi-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .kpi-value { font-size: 1.2rem; font-weight: 700; color: var(--accent); line-height: 1.2; }
    .heatmap { display: grid; gap: 3px; margin: 0.5rem 0 1rem; }
    .heat-cell { aspect-ratio: 1; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; }
    .heat-label { font-size: 0.55rem; font-weight: 500; opacity: 0.85; }
    table.data { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    table.data th, table.data td { border-bottom: 1px solid var(--line); padding: 0.4rem 0.35rem; text-align: left; }
    table.data th { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
    tr.is-target td { background: #ecfdf5; font-weight: 600; }
    tr.is-selected td { box-shadow: inset 3px 0 0 var(--accent); }
    .badge { display: inline-block; background: var(--accent); color: #fff; border-radius: 3px; font-size: 0.65rem; padding: 0.1rem 0.35rem; margin-left: 0.25rem; font-weight: 700; }
    .dist { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.5rem; }
    .dist-item { border: 1px solid var(--line); border-radius: 8px; padding: 0.5rem 0.65rem; }
    .dist-item strong { display: block; font-size: 1.1rem; color: var(--accent); }
    .chart { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
    .delta-row { display: flex; gap: 1rem; flex-wrap: wrap; margin: 0.5rem 0 1rem; font-size: 0.85rem; }
    .delta-row span { border: 1px solid var(--line); border-radius: 6px; padding: 0.35rem 0.6rem; background: #fff; }
    footer.report-footer { margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid var(--line); font-size: 0.72rem; color: var(--muted); display: flex; justify-content: space-between; gap: 1rem; }
    .page-break { break-before: page; page-break-before: always; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.35rem 0 0.75rem; }
    .chip { font-size: 0.75rem; border: 1px solid var(--line); border-radius: 999px; padding: 0.15rem 0.55rem; }
    .chip.up { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
    .chip.down { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
    @page { margin: 12mm; }
    @media print {
      body { background: #fff; counter-reset: page; }
      .print-bar { display: none !important; }
      .kpi, .dist-item, .heat-cell, table.data tr.is-target td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      a { color: inherit; text-decoration: none; }
      .page-num::after { counter-increment: page; content: "Page " counter(page); }
    }
    @media (max-width: 720px) {
      .kpi-row, .dist { grid-template-columns: repeat(2, minmax(0,1fr)); }
      header.report-header { flex-direction: column; }
      .meta { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="print-bar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
    <header class="report-header">
      <div class="brand">
        ${wl.logoUrl ? `<img src="${escapeHtml(wl.logoUrl)}" alt="${escapeHtml(wl.companyName)}"/>` : ""}
        <div>
          <div class="brand-name">${escapeHtml(wl.companyName)}</div>
          <h1>${escapeHtml(reportTitle(payload.reportType))}</h1>
        </div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(bizName)}</strong></div>
        <div>${escapeHtml(periodLabel(payload))}</div>
      </div>
    </header>
    ${body}
    <footer class="report-footer">
      <div>${footerBits.map((b) => escapeHtml(String(b))).join(" · ")}</div>
      <div class="page-num"></div>
    </footer>
  </div>
</body>
</html>`;
}

function renderSingleScan(payload: SingleScanReportPayload): string {
  const dist = payload.rankDistribution
    .map(
      (d) =>
        `<div class="dist-item"><strong>${d.count}</strong><span class="muted">${escapeHtml(d.label)}</span></div>`
    )
    .join("");
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · ${payload.parameters.gridSize}×${payload.parameters.gridSize} · ${payload.parameters.radiusMeters}m · ${escapeHtml(payload.parameters.platform)}${payload.parameters.centerLabel ? ` · ${escapeHtml(payload.parameters.centerLabel)}` : ""}</p>
    ${kpiCards(payload.kpis)}
    <h2>Rank heatmap</h2>
    ${heatmapHtml(payload.heatmap.gridSize, payload.heatmap.cells)}
    <h2>Rank distribution</h2>
    <div class="dist">${dist}</div>
    <section class="page-break">
      <h2>Competitors</h2>
      ${competitorTable(payload.competitors)}
    </section>`;
  return shell(payload, body);
}

function renderTrend(payload: TrendReportPayload): string {
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · ${payload.parameters.gridSize}×${payload.parameters.gridSize} · ${payload.parameters.radiusMeters}m · ${payload.parameters.scanCount} scans</p>
    <div class="delta-row">
      <span>ARP ${escapeHtml(fmt(payload.current.arp))} <small class="muted">(Δ ${escapeHtml(fmt(payload.deltas.arp))} vs prior · + = improved)</small></span>
      <span>ATRP ${escapeHtml(fmt(payload.current.atrp))} <small class="muted">(Δ ${escapeHtml(fmt(payload.deltas.atrp))} · + = improved)</small></span>
      <span>SoLV ${escapeHtml(fmt(payload.current.solv))}% <small class="muted">(Δ ${escapeHtml(fmt(payload.deltas.solv))} · + = improved)</small></span>
    </div>
    <h2>Trend</h2>
    ${trendChartSvg(payload.series)}
    <h2>Series</h2>
    <table class="data">
      <thead><tr><th>Date</th><th>ARP</th><th>ATRP</th><th>SoLV</th><th>Top 3%</th><th>Visibility</th></tr></thead>
      <tbody>
        ${payload.series
          .map(
            (s) => `<tr>
          <td>${escapeHtml(s.date)}</td>
          <td>${escapeHtml(fmt(s.arp))}</td>
          <td>${escapeHtml(fmt(s.atrp))}</td>
          <td>${escapeHtml(fmt(s.solv))}%</td>
          <td>${escapeHtml(fmt(s.top3Pct))}%</td>
          <td>${escapeHtml(fmt(s.visibilityScore, 0))}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  return shell(payload, body);
}

function renderCompetitor(payload: CompetitorReportPayload): string {
  const selectedSet = new Set(payload.selectedCompetitorKeys);
  const focused = payload.competitors.filter(
    (c) => c.isTarget || selectedSet.has(c.key)
  );
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · scanned ${escapeHtml(payload.parameters.scannedAt)} · ${payload.parameters.gridSize}×${payload.parameters.gridSize}</p>
    <p class="muted">Showing selected competitor grid keys (${payload.selectedCompetitorKeys.length}). Full table includes all ranked competitors ordered by ATRP.</p>
    <h2>Selected set</h2>
    ${competitorTable(focused.length ? focused : [payload.target], {
      selectedKeys: payload.selectedCompetitorKeys,
      highlightSelected: true,
    })}
    <section class="page-break">
      <h2>All competitors (by ATRP)</h2>
      ${competitorTable(payload.competitors, {
        selectedKeys: payload.selectedCompetitorKeys,
        highlightSelected: true,
      })}
    </section>`;
  return shell(payload, body);
}

function renderLocation(payload: LocationReportPayload): string {
  const rising = payload.rising
    .slice(0, 8)
    .map((k) => `<span class="chip up">${escapeHtml(k)}</span>`)
    .join("");
  const falling = payload.falling
    .slice(0, 8)
    .map((k) => `<span class="chip down">${escapeHtml(k)}</span>`)
    .join("");
  const body = `
    <p class="muted">${payload.parameters.keywordCount} keywords · ${escapeHtml(payload.parameters.dateFrom)} → ${escapeHtml(payload.parameters.dateTo)}</p>
    ${rollupKpiCards(payload.aggregate, "Keywords with rank")}
    <h2>Rising / falling</h2>
    <div class="chips">${rising || '<span class="muted">No rising keywords</span>'}</div>
    <div class="chips">${falling || '<span class="muted">No falling keywords</span>'}</div>
    <h2>Keywords</h2>
    <table class="data">
      <thead><tr><th>Keyword</th><th>ARP</th><th>ATRP</th><th>SoLV</th><th>Δ ARP</th><th>Last scan</th></tr></thead>
      <tbody>
        ${payload.keywords
          .map(
            (k) => `<tr>
          <td>${escapeHtml(k.keyword)}</td>
          <td>${escapeHtml(fmt(k.arp))}</td>
          <td>${escapeHtml(fmt(k.atrp))}</td>
          <td>${escapeHtml(fmt(k.solv))}%</td>
          <td>${escapeHtml(fmt(k.changeArp))}</td>
          <td>${escapeHtml(k.scannedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  return shell(payload, body);
}

function renderKeyword(payload: KeywordReportPayload): string {
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · ${payload.parameters.locationCount} locations · ${payload.parameters.gridSize}×${payload.parameters.gridSize} · ${payload.parameters.radiusMeters}m</p>
    ${rollupKpiCards(payload.aggregate, "Locations with rank")}
    <h2>Locations</h2>
    <table class="data">
      <thead><tr><th>Location</th><th>ARP</th><th>ATRP</th><th>SoLV</th><th>Last scan</th></tr></thead>
      <tbody>
        ${payload.locations
          .map(
            (l) => `<tr>
          <td>${escapeHtml(l.name)}${l.isBusinessLocation ? ' <span class="badge">Primary</span>' : ""}</td>
          <td>${escapeHtml(fmt(l.arp))}</td>
          <td>${escapeHtml(fmt(l.atrp))}</td>
          <td>${escapeHtml(fmt(l.solv))}%</td>
          <td>${escapeHtml(l.scannedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  return shell(payload, body);
}

function renderMapsCampaign(payload: MapsCampaignReportPayload): string {
  const rising = payload.rising
    .slice(0, 8)
    .map((k) => `<span class="chip up">${escapeHtml(k)}</span>`)
    .join("");
  const falling = payload.falling
    .slice(0, 8)
    .map((k) => `<span class="chip down">${escapeHtml(k)}</span>`)
    .join("");
  const scheduleLine = payload.parameters.scheduleEnabled
    ? `Weekly schedule on · next ${escapeHtml(payload.parameters.nextRunAt ?? "—")}`
    : "Weekly schedule off";
  const body = `
    <p class="muted">${scheduleLine} · ${payload.parameters.keywordCount} keywords</p>
    ${rollupKpiCards(payload.aggregate, "Keywords with rank")}
    <h2>Rising / falling</h2>
    <div class="chips">${rising || '<span class="muted">No rising keywords</span>'}</div>
    <div class="chips">${falling || '<span class="muted">No falling keywords</span>'}</div>
    <h2>Tracked keywords</h2>
    <table class="data">
      <thead><tr><th>Keyword</th><th>ARP</th><th>ATRP</th><th>SoLV</th><th>Δ ARP</th><th>Last scan</th></tr></thead>
      <tbody>
        ${payload.keywords
          .map(
            (k) => `<tr>
          <td>${escapeHtml(k.keyword)}</td>
          <td>${escapeHtml(fmt(k.arp))}</td>
          <td>${escapeHtml(fmt(k.atrp))}</td>
          <td>${escapeHtml(fmt(k.solv))}%</td>
          <td>${escapeHtml(fmt(k.changeArp))}</td>
          <td>${escapeHtml(k.scannedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  return shell(payload, body);
}

function renderReviews(payload: ReviewsReportPayload): string {
  const t = payload.target;
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.auditedAt ?? "Latest momentum audit")}${payload.summary ? ` · ${escapeHtml(payload.summary)}` : ""}</p>
    ${simpleKpiRow([
      { label: "Rating", value: fmt(t.rating) },
      { label: "Total", value: String(t.totalReviews) },
      { label: "30d", value: String(t.reviews30d) },
      { label: "Momentum", value: t.momentumLabel ?? "—" },
      { label: "Score", value: fmt(t.momentumScore, 0) },
      { label: "Resp %", value: t.responseRate != null ? `${t.responseRate}%` : "—" },
      { label: "Unanswered 90d", value: t.unanswered90d != null ? String(t.unanswered90d) : "—" },
      { label: "Gap to top 3", value: fmt(t.gapToTop3_30d, 0) },
    ])}
    <h2>Competitors</h2>
    <table class="data">
      <thead><tr><th>Business</th><th>Rating</th><th>Total</th><th>30d</th><th>Weekly</th><th>Momentum</th></tr></thead>
      <tbody>
        <tr class="is-target">
          <td>${escapeHtml(t.name)} <span class="badge">You</span></td>
          <td>${escapeHtml(fmt(t.rating))}</td>
          <td>${t.totalReviews}</td>
          <td>${t.reviews30d}</td>
          <td>${escapeHtml(fmt(t.avgReviewsPerWeek))}</td>
          <td>${escapeHtml(t.momentumLabel ?? "—")}</td>
        </tr>
        ${payload.competitors
          .map(
            (c) => `<tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(fmt(c.rating))}</td>
          <td>${c.totalReviews}</td>
          <td>${c.reviews30d}</td>
          <td>${escapeHtml(fmt(c.avgReviewsPerWeek))}</td>
          <td>${escapeHtml(c.momentumLabel ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${
      payload.tasks.length
        ? `<h2>Recommended actions</h2>
    <table class="data">
      <thead><tr><th>Task</th><th>Priority</th></tr></thead>
      <tbody>
        ${payload.tasks
          .map(
            (task) => `<tr>
          <td><strong>${escapeHtml(task.title)}</strong>${task.description ? `<div class="muted">${escapeHtml(task.description)}</div>` : ""}</td>
          <td>${escapeHtml(task.priority ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
        : ""
    }`;
  return shell(payload, body);
}

function renderReviewCampaign(payload: ReviewCampaignReportPayload): string {
  const f = payload.funnel;
  const a = payload.attribution;
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.campaignName)} · ${escapeHtml(payload.parameters.status)} · ${escapeHtml(payload.parameters.channel)}</p>
    ${simpleKpiRow([
      { label: "Recipients", value: String(f.recipientsTotal) },
      { label: "Sent", value: String(f.sent) },
      { label: "Delivered", value: String(f.delivered) },
      { label: "Clicked", value: String(f.clicked) },
      { label: "Replied", value: String(f.replied) },
      { label: "Failed", value: String(f.failed) },
      { label: "Opted out", value: String(f.optedOut) },
      { label: "Attributed", value: String(a.confirmed + a.likely) },
    ])}
    <h2>Rates</h2>
    <div class="delta-row">
      <span>Delivery ${escapeHtml(fmt(payload.rates.deliveryRate))}%</span>
      <span>Click ${escapeHtml(fmt(payload.rates.clickRate))}%</span>
      <span>Reply ${escapeHtml(fmt(payload.rates.replyRate))}%</span>
      <span>Attributed ${escapeHtml(fmt(payload.rates.attributedReviewRate))}%</span>
    </div>
    <h2>Attribution</h2>
    <div class="dist">
      <div class="dist-item"><strong>${a.confirmed}</strong><span class="muted">Confirmed</span></div>
      <div class="dist-item"><strong>${a.likely}</strong><span class="muted">Likely</span></div>
      <div class="dist-item"><strong>${a.unattributed}</strong><span class="muted">Unattributed</span></div>
      <div class="dist-item"><strong>${f.sms}/${f.email}</strong><span class="muted">SMS / Email</span></div>
    </div>
    <h2>Recipients (sample)</h2>
    <table class="data">
      <thead><tr><th>Name</th><th>Status</th><th>Channel</th><th>Replied</th><th>Review</th></tr></thead>
      <tbody>
        ${payload.recipients
          .map(
            (r) => `<tr>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(r.channel ?? "—")}</td>
          <td>${escapeHtml(r.repliedAt ?? "—")}</td>
          <td>${escapeHtml(r.reviewDetectedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <section class="page-break">
      <h2>Activity</h2>
      <table class="data">
        <thead><tr><th>When</th><th>Type</th><th>Event</th></tr></thead>
        <tbody>
          ${payload.activity
            .slice(0, 40)
            .map(
              (ev) => `<tr>
            <td>${escapeHtml(ev.at)}</td>
            <td>${escapeHtml(ev.type)}</td>
            <td>${escapeHtml(ev.label)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>`;
  return shell(payload, body);
}

export function renderReportHtml(payload: AnyReportPayload): string {
  switch (payload.reportType) {
    case "single_scan":
      return renderSingleScan(payload);
    case "trend":
      return renderTrend(payload);
    case "competitor":
      return renderCompetitor(payload);
    case "location":
      return renderLocation(payload);
    case "keyword":
      return renderKeyword(payload);
    case "maps_campaign":
      return renderMapsCampaign(payload);
    case "reviews":
      return renderReviews(payload);
    case "review_campaign":
      return renderReviewCampaign(payload);
    default: {
      const _exhaustive: never = payload;
      return shell(_exhaustive, "<p>Unsupported report type</p>");
    }
  }
}
