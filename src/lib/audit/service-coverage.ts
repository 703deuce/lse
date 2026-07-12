import type { GbpProfile, LoadedCompetitor, ParsedPage } from "@/lib/audit/types";
import { normalizeText } from "@/lib/audit/types";
import { pageMatchesService } from "@/lib/audit/website-crawler";

export type ServiceKeywordRow = {
  service: string;
  onYourWebsite: boolean;
  onYourGbp: boolean;
  competitorTop3Count: number;
  competitorTop10Count: number;
  competitorTop20Count: number;
  totalCompetitors: number;
  opportunity: "high" | "medium" | "low";
  note: string;
};

export type ServiceCoverageAuditResult = {
  rows: ServiceKeywordRow[];
  totalCompetitors: number;
};

const SKIP_TERM =
  /^(google|reviews?|service|services|business|company|local|near me|best|top)$/i;

function isPlausibleServiceTerm(term: string): boolean {
  const t = term.trim();
  if (t.length < 4 || t.length > 80) return false;
  if (SKIP_TERM.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

function extractTermsFromCompetitor(comp: LoadedCompetitor): string[] {
  const raw = [
    ...(comp.serviceKeywords ?? []),
    ...(comp.services ?? []),
    ...(comp.reviewKeywords ?? []),
  ];
  const out = new Map<string, string>();
  for (const term of raw) {
    if (!isPlausibleServiceTerm(term)) continue;
    const key = normalizeText(term);
    if (!out.has(key)) out.set(key, term.trim());
  }
  return [...out.values()];
}

function countCompetitorsWithTerm(
  competitors: LoadedCompetitor[],
  termKey: string,
  limit: number
): number {
  let n = 0;
  for (let i = 0; i < Math.min(limit, competitors.length); i++) {
    const terms = extractTermsFromCompetitor(competitors[i]).map(normalizeText);
    if (terms.some((t) => t === termKey || t.includes(termKey) || termKey.includes(t))) n++;
  }
  return n;
}

function onGbp(gbp: GbpProfile, termKey: string): boolean {
  const hay = [
    gbp.primaryCategory,
    ...(gbp.secondaryCategories ?? []),
    ...(gbp.services ?? []),
  ]
    .filter(Boolean)
    .map((s) => normalizeText(s!));
  return hay.some((h) => h === termKey || h.includes(termKey) || termKey.includes(h));
}

function onWebsite(pages: ParsedPage[], termKey: string): boolean {
  return pages.some(
    (p) =>
      pageMatchesService(p, termKey) ||
      normalizeText(`${p.title} ${p.h1.join(" ")} ${p.url}`).includes(termKey)
  );
}

function opportunityLevel(top3: number, top20: number): ServiceKeywordRow["opportunity"] {
  if (top3 >= 2 || top20 >= 6) return "high";
  if (top3 >= 1 || top20 >= 3) return "medium";
  return "low";
}

function buildNote(row: Omit<ServiceKeywordRow, "note">): string {
  if (row.onYourWebsite && row.onYourGbp) {
    return "Covered on GBP and website.";
  }
  if (!row.onYourWebsite && !row.onYourGbp) {
    return `${row.competitorTop20Count}/${row.totalCompetitors} competitors mention or list this service — consider adding only if you offer it.`;
  }
  if (!row.onYourWebsite) {
    return "Listed on GBP but no matching page found on your site.";
  }
  return "Found on website but not clearly listed on GBP services.";
}

export function runServiceCoverageAudit(
  gbp: GbpProfile,
  competitors: LoadedCompetitor[],
  pages: ParsedPage[] = []
): ServiceCoverageAuditResult {
  const top20 = competitors.slice(0, 20);
  const termMap = new Map<string, string>();

  for (const comp of top20) {
    for (const term of extractTermsFromCompetitor(comp)) {
      const key = normalizeText(term);
      if (!termMap.has(key)) termMap.set(key, term);
    }
  }

  const rows: ServiceKeywordRow[] = [];

  for (const [key, display] of termMap) {
    const top3 = countCompetitorsWithTerm(top20, key, 3);
    const top10 = countCompetitorsWithTerm(top20, key, 10);
    const top20c = countCompetitorsWithTerm(top20, key, 20);
    if (top20c < 2) continue;

    const base = {
      service: display,
      onYourWebsite: onWebsite(pages, key),
      onYourGbp: onGbp(gbp, key),
      competitorTop3Count: top3,
      competitorTop10Count: top10,
      competitorTop20Count: top20c,
      totalCompetitors: top20.length,
      opportunity: opportunityLevel(top3, top20c),
    };

    rows.push({ ...base, note: buildNote(base) });
  }

  rows.sort((a, b) => {
    if (b.competitorTop20Count !== a.competitorTop20Count) {
      return b.competitorTop20Count - a.competitorTop20Count;
    }
    const aGap = !a.onYourWebsite || !a.onYourGbp ? 1 : 0;
    const bGap = !b.onYourWebsite || !b.onYourGbp ? 1 : 0;
    return bGap - aGap;
  });

  return { rows: rows.slice(0, 25), totalCompetitors: top20.length };
}

export function competitorMentionsArea(comp: LoadedCompetitor, area: string): boolean {
  const norm = normalizeText(area);
  const parts = [
    ...(comp.reviewKeywords ?? []),
    ...(comp.serviceKeywords ?? []),
    ...(comp.services ?? []),
    comp.category ?? "",
    ...(comp.additionalCategories ?? []),
  ];
  return parts.some((p) => {
    const n = normalizeText(p);
    return n.includes(norm) || norm.includes(n);
  });
}

export function countCompetitorsMentioningArea(
  competitors: LoadedCompetitor[],
  area: string,
  limit = 20
): number {
  return competitors.slice(0, limit).filter((c) => competitorMentionsArea(c, area)).length;
}
