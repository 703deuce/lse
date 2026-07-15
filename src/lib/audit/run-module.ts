import {
  loadGbpProfile,
  runFullAuditSuite,
  saveAuditRun,
  loadCompetitorsForBusiness,
} from "@/lib/audit/run-audit";
import { runWebsiteMatchAudit } from "@/lib/audit/website-match";
import { runCategoryGapAudit } from "@/lib/audit/category-gap";
import { runCore30Audit } from "@/lib/audit/core30";
import { runHyperLocalAudit } from "@/lib/audit/hyperlocal";
import { runCompetitorGapAudit } from "@/lib/audit/competitor-gap";
import { runReviewAudit, runPostAudit, runPhotoAudit } from "@/lib/audit/gbp-modules";

export const AUDIT_MODULES = [
  "website-match",
  "category-gap",
  "core30",
  "hyperlocal",
  "competitor-gaps",
  "reviews",
  "posts",
  "photos",
  "action-plan",
  "full",
] as const;

export type AuditModuleType = (typeof AUDIT_MODULES)[number];

export function isAuditModule(value: string): value is AuditModuleType {
  return (AUDIT_MODULES as readonly string[]).includes(value);
}

/** Shared GBP audit execution for HTTP (legacy sync) and queue workers. */
export async function executeAuditModule(params: {
  businessId: string;
  module: AuditModuleType;
  keyword?: string;
}): Promise<unknown> {
  const { businessId, module, keyword } = params;

  if (module === "full") {
    const result = await runFullAuditSuite(businessId, keyword);
    await saveAuditRun(businessId, "full", result, result.website.score);
    return result;
  }

  const gbp = await loadGbpProfile(businessId);
  if (!gbp) throw new Error("Business not found");

  const competitors = await loadCompetitorsForBusiness(businessId);
  const competitorCategories = competitors.flatMap((c) =>
    [c.category, ...(c.additionalCategories ?? [])].filter(Boolean) as string[]
  );
  const competitorPhotoAvg =
    competitors.length > 0
      ? competitors.reduce((s, c) => s + (c.photoCount ?? 0), 0) / competitors.length
      : undefined;

  switch (module) {
    case "website-match": {
      const result = await runWebsiteMatchAudit(gbp, keyword);
      await saveAuditRun(businessId, module, result, result.score);
      return result;
    }
    case "category-gap": {
      const result = await runCategoryGapAudit(gbp, competitorCategories);
      await saveAuditRun(businessId, module, result);
      return result;
    }
    case "core30": {
      const result = await runCore30Audit(gbp);
      await saveAuditRun(businessId, module, result, result.completionScore);
      return result;
    }
    case "hyperlocal": {
      const result = await runHyperLocalAudit(gbp);
      await saveAuditRun(businessId, module, result, result.score);
      return result;
    }
    case "competitor-gaps": {
      const result = await runCompetitorGapAudit(gbp, competitors);
      await saveAuditRun(businessId, module, result);
      return result;
    }
    case "reviews": {
      const result = await runReviewAudit(gbp, businessId);
      await saveAuditRun(businessId, module, result);
      return result;
    }
    case "posts": {
      const result = await runPostAudit(gbp, businessId);
      await saveAuditRun(businessId, module, result);
      return result;
    }
    case "photos": {
      const result = await runPhotoAudit(gbp, businessId, competitorPhotoAvg);
      await saveAuditRun(businessId, module, result);
      return result;
    }
    case "action-plan": {
      const suite = await runFullAuditSuite(businessId, keyword);
      await saveAuditRun(businessId, module, suite.actionPlan);
      return suite.actionPlan;
    }
    default:
      throw new Error("Unknown module");
  }
}
