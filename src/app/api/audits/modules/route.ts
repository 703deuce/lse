import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
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

const MODULES = [
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

type ModuleType = (typeof MODULES)[number] | string;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, module, keyword } = body as {
      businessId: string;
      module: ModuleType;
      keyword?: string;
    };

    if (!businessId || !module) {
      return NextResponse.json({ error: "businessId and module required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);

    if (module === "full") {
      const result = await runFullAuditSuite(businessId, keyword);
      await saveAuditRun(businessId, "full", result, result.website.score);
      return NextResponse.json(result);
    }

    const gbp = await loadGbpProfile(businessId);
    if (!gbp) return NextResponse.json({ error: "Business not found" }, { status: 404 });

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
        return NextResponse.json(result);
      }
      case "category-gap": {
        const result = await runCategoryGapAudit(gbp, competitorCategories);
        await saveAuditRun(businessId, module, result);
        return NextResponse.json(result);
      }
      case "core30": {
        const result = await runCore30Audit(gbp);
        await saveAuditRun(businessId, module, result, result.completionScore);
        return NextResponse.json(result);
      }
      case "hyperlocal": {
        const result = await runHyperLocalAudit(gbp);
        await saveAuditRun(businessId, module, result, result.score);
        return NextResponse.json(result);
      }
      case "competitor-gaps": {
        const result = await runCompetitorGapAudit(gbp, competitors);
        await saveAuditRun(businessId, module, result);
        return NextResponse.json(result);
      }
      case "reviews": {
        const result = await runReviewAudit(gbp, businessId);
        await saveAuditRun(businessId, module, result);
        return NextResponse.json(result);
      }
      case "posts": {
        const result = await runPostAudit(gbp, businessId);
        await saveAuditRun(businessId, module, result);
        return NextResponse.json(result);
      }
      case "photos": {
        const result = await runPhotoAudit(gbp, businessId, competitorPhotoAvg);
        await saveAuditRun(businessId, module, result);
        return NextResponse.json(result);
      }
      case "action-plan": {
        const suite = await runFullAuditSuite(businessId, keyword);
        await saveAuditRun(businessId, module, suite.actionPlan);
        return NextResponse.json(suite.actionPlan);
      }
      default:
        return NextResponse.json({ error: "Unknown module" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit module failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
