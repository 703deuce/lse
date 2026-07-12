import { normalizeText } from "@/lib/audit/types";
import type { CategoryGapResult } from "@/lib/audit/category-gap";
import type { Core30Result } from "@/lib/audit/core30";
import type { ServiceCoverageAuditResult } from "@/lib/audit/service-coverage";
import type { ServiceCoverageRow, ServiceCoverageSection } from "@/lib/growth-audit/types";

function normService(s: string): string {
  return normalizeText(s);
}

function keywordToRow(kw: ServiceCoverageAuditResult["rows"][0]): ServiceCoverageRow {
  const pageExists = kw.onYourWebsite;
  const status: ServiceCoverageRow["status"] = pageExists && kw.onYourGbp
    ? "excellent"
    : pageExists || kw.onYourGbp
      ? "weak"
      : "missing";

  return {
    service: kw.service,
    gbpListed: kw.onYourGbp,
    pageExists,
    status,
    score: status === "excellent" ? 85 : status === "weak" ? 45 : undefined,
    competitorNote: `${kw.competitorTop20Count}/${kw.totalCompetitors} competitors`,
    onYourGbp: kw.onYourGbp,
    competitorTop20Count: kw.competitorTop20Count,
    opportunity: kw.opportunity,
  };
}

export function buildServiceCoverageSection(
  categoryGap: CategoryGapResult,
  core30: Core30Result,
  serviceKeywords?: ServiceCoverageAuditResult
): ServiceCoverageSection {
  const kwAudit = serviceKeywords ?? { rows: [], totalCompetitors: 0 };
  const rowMap = new Map<string, ServiceCoverageRow>();

  for (const kw of kwAudit.rows) {
    rowMap.set(normService(kw.service), keywordToRow(kw));
  }

  for (const svc of categoryGap.services) {
    if (!svc) continue;
    const key = normService(svc);
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        service: svc,
        gbpListed: true,
        pageExists: !categoryGap.missingPages.some((m) => normService(m.service) === key),
        status: "missing",
      });
    }
  }

  for (const mp of core30.missingPages) {
    const key = normService(mp.name);
    const existing = rowMap.get(key);
    if (existing) {
      existing.pageExists = false;
      existing.status = "missing";
    } else {
      rowMap.set(key, {
        service: mp.name,
        gbpListed: true,
        pageExists: false,
        status: "missing",
      });
    }
  }

  for (const wp of core30.weakPages) {
    for (const row of rowMap.values()) {
      if (wp.url.toLowerCase().includes(normService(row.service).replace(/\s/g, "-"))) {
        row.pageUrl = wp.url;
        row.status = "weak";
        row.score = 40;
      }
    }
  }

  const matching = core30.matchingPagesFound;
  const total = Math.max(core30.gbpServicesFound, 1);
  const keywordRows = kwAudit.rows;
  const keywordCovered = keywordRows.filter((r) => r.onYourWebsite && r.onYourGbp).length;
  const keywordScore =
    keywordRows.length > 0 ? Math.round((keywordCovered / keywordRows.length) * 100) : null;
  const coreScore = core30.completionScore || Math.round((matching / total) * 100);
  const score = keywordScore != null ? Math.round((coreScore + keywordScore) / 2) : coreScore;

  for (const row of rowMap.values()) {
    if (row.pageExists && row.status !== "weak") {
      row.status = "excellent";
      row.score = row.score ?? 85;
    }
    const kwMatch = kwAudit.rows.find((k) => normService(k.service) === normService(row.service));
    if (kwMatch) {
      row.competitorNote = kwMatch.note;
      row.competitorTop20Count = kwMatch.competitorTop20Count;
      row.opportunity = kwMatch.opportunity;
      row.onYourGbp = kwMatch.onYourGbp;
    }
  }

  const rows = [...rowMap.values()].sort((a, b) => {
    const aScore = (a.competitorTop20Count ?? 0) * (a.status === "missing" ? 2 : 1);
    const bScore = (b.competitorTop20Count ?? 0) * (b.status === "missing" ? 2 : 1);
    return bScore - aScore;
  });

  return {
    score,
    rows,
    categoryGap,
    core30,
    serviceKeywords: kwAudit,
  };
}
