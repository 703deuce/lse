import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { createServiceClient } from "@/lib/db/client";
import { materializeCampaignTemplate } from "@/lib/reputation/campaign-templates";
import { createReviewCampaign } from "@/lib/reputation/campaigns";
import { ymdInTimeZone } from "@/lib/reputation/campaign-scheduler";
import { PlanLimitError } from "@/lib/plans";

/**
 * Copy an immutable system template into an organization-owned draft campaign.
 * Audience is empty — user adds CSV/contacts or attaches a webhook next.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      businessId?: string;
      name?: string;
      timezone?: string;
    };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const materialized = materializeCampaignTemplate(templateId);
    if (!materialized) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const auth = await requireBusinessAccess(body.businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    // Ensure a review destination exists before drafting a campaign.
    const supabase = createServiceClient();
    const { data: link } = await supabase
      .from("review_request_links")
      .select("id, review_url")
      .eq("business_id", body.businessId)
      .eq("is_active", true)
      .maybeSingle();
    if (!link?.review_url) {
      return NextResponse.json(
        {
          error:
            "Generate a Google review link for this business before using a campaign template.",
          code: "review_link_required",
        },
        { status: 400 }
      );
    }

    const tz = body.timezone?.trim() || materialized.template.timezoneHint || "America/New_York";
    const result = await createReviewCampaign({
      organizationId: auth.organizationId,
      businessId: body.businessId,
      name: body.name?.trim() || materialized.name,
      description: materialized.description,
      channel: materialized.channel,
      dailySendLimit: materialized.dailySendLimit,
      sendDays: materialized.sendDays,
      sendWindowStart: materialized.sendWindowStart,
      sendWindowEnd: materialized.sendWindowEnd,
      timezone: tz,
      duplicateProtectionDays: materialized.duplicateProtectionDays,
      startDate: ymdInTimeZone(new Date(), tz),
      consentConfirmed: false,
      filename: "template-draft.csv",
      mapping: { phone: "phone", email: "email" },
      recipients: [],
      sequence: materialized.sequence,
      status: "draft",
      objective: materialized.objective,
      successMode: materialized.successMode,
      sourceTemplateId: materialized.sourceTemplateId,
      sourceTemplateVersion: materialized.sourceTemplateVersion,
    });

    return NextResponse.json({
      ok: true,
      campaign: result.campaign,
      templateId: materialized.sourceTemplateId,
      templateVersion: materialized.sourceTemplateVersion,
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json(
        { error: err.message, entitlement: err.entitlement },
        { status: 403 }
      );
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Failed to use template";
    const status =
      /access denied|not found/i.test(message) ? 403 : /auth/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
