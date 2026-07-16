import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import {
  listCampaignSystemTemplates,
  recommendCampaignTemplate,
  type CampaignTemplateFilter,
} from "@/lib/reputation/campaign-templates";

const FILTERS = new Set<CampaignTemplateFilter>([
  "sms",
  "email",
  "multi-channel",
  "automatic",
  "manual-csv",
  "service-business",
  "appointment-business",
  "past-customer-reactivation",
]);

export async function GET(request: Request) {
  try {
    await requireAuth();
    const url = new URL(request.url);
    const raw = url.searchParams.getAll("filter").concat(
      url.searchParams.get("filters")?.split(",").filter(Boolean) ?? []
    );
    const filters = raw.filter((f): f is CampaignTemplateFilter =>
      FILTERS.has(f as CampaignTemplateFilter)
    );
    const templates = listCampaignSystemTemplates(filters.length ? filters : undefined);
    const recommended = recommendCampaignTemplate({
      hasSmsConsentCapability: url.searchParams.get("sms") !== "0",
      isHomeService: url.searchParams.get("homeService") === "1",
    });
    return NextResponse.json({
      templates,
      recommendedId: recommended.id,
      featuredId: templates.find((t) => t.featured)?.id ?? "sms-email-follow-up",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list templates";
    const status = /auth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
