import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  buildIncomingWebhookUrl,
  createWebhookEndpoint,
  listWebhookEndpoints,
} from "@/lib/integrations/webhook-endpoints";
import { createServiceClient } from "@/lib/db/client";
import { assertWithinLimit, PlanLimitError } from "@/lib/plans";
import type { FieldMapping } from "@/lib/integrations/webhook-mapping";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const access = await requireBusinessAccess(businessId);
    await requireEntitlement(access.organizationId, "review_campaigns");

    const endpoints = await listWebhookEndpoints({
      organizationId: access.organizationId,
      businessId,
    });

    const supabase = createServiceClient();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count: monthEvents } = await supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organizationId)
      .gte("received_at", monthStart.toISOString());
    const { count: monthOk } = await supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organizationId)
      .in("status", ["completed", "ignored_test", "ignored_duplicate", "ignored_suppressed", "ignored_recently_requested"])
      .gte("received_at", monthStart.toISOString());
    const { count: monthFail } = await supabase
      .from("integration_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organizationId)
      .in("status", ["failed_retryable", "failed_permanent", "rejected_invalid", "rejected_unauthorized"])
      .gte("received_at", monthStart.toISOString());

    return NextResponse.json({
      endpoints: endpoints.map((e) => ({
        id: e.id,
        name: e.name,
        businessId: e.business_id ?? e.default_business_id,
        campaignId: e.campaign_id ?? e.default_campaign_id,
        eventType: e.default_event_type,
        isTest: e.is_test,
        isActive: e.is_active,
        signatureRequired: e.signature_required,
        tokenLastFour: e.endpoint_token_last_four,
        sendDelayMinutes: e.send_delay_minutes,
        lastReceivedAt: e.last_received_at,
        lastSuccessAt: e.last_success_at,
        lastFailureAt: e.last_failure_at,
        createdAt: e.created_at,
      })),
      metrics: {
        active: endpoints.filter((e) => e.is_active).length,
        eventsThisMonth: monthEvents ?? 0,
        successful: monthOk ?? 0,
        failed: monthFail ?? 0,
      },
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to list webhooks");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      campaignId?: string;
      name?: string;
      description?: string;
      eventType?: string;
      isTest?: boolean;
      signatureRequired?: boolean;
      sendDelayMinutes?: number;
      duplicateWindowDays?: number;
      fieldMapping?: FieldMapping;
      contactUpdateMode?: string;
      requireEmailConsent?: boolean;
      requireSmsConsent?: boolean;
    };
    if (!body.businessId || !body.campaignId || !body.name?.trim()) {
      return NextResponse.json(
        { error: "businessId, campaignId, and name are required" },
        { status: 400 }
      );
    }

    const access = await requireBusinessAccess(body.businessId);
    await requireEntitlement(access.organizationId, "review_campaigns");
    await assertWithinLimit(access.organizationId, "webhook_endpoints", 1);
    const auth = await requireAuth();

    const supabase = createServiceClient();
    const { data: campaign } = await supabase
      .from("review_request_campaigns")
      .select("id, status, business_id")
      .eq("id", body.campaignId)
      .eq("business_id", body.businessId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found for this business" }, { status: 400 });
    }
    if (!["active", "scheduled"].includes(String(campaign.status))) {
      return NextResponse.json(
        {
          error: `Campaign must be active or scheduled (currently ${campaign.status}). Promote the campaign first.`,
        },
        { status: 400 }
      );
    }

    const created = await createWebhookEndpoint({
      organizationId: access.organizationId,
      businessId: body.businessId,
      campaignId: body.campaignId,
      name: body.name,
      description: body.description,
      eventType: body.eventType,
      isTest: body.isTest ?? true,
      signatureRequired: body.signatureRequired ?? false,
      sendDelayMinutes: body.sendDelayMinutes ?? 0,
      duplicateWindowDays: body.duplicateWindowDays ?? 90,
      fieldMapping: body.fieldMapping,
      contactUpdateMode: body.contactUpdateMode,
      requireEmailConsent: body.requireEmailConsent,
      requireSmsConsent: body.requireSmsConsent,
      createdByUserId: auth.userId,
    });

    return NextResponse.json({
      endpoint: {
        id: created.endpoint.id,
        name: created.endpoint.name,
        isTest: created.endpoint.is_test,
        isActive: created.endpoint.is_active,
        tokenLastFour: created.endpoint.endpoint_token_last_four,
      },
      webhookUrl: buildIncomingWebhookUrl(created.rawToken),
      rawToken: created.rawToken,
      signingSecret: created.signingSecret,
      warning: "Copy the webhook URL (and signing secret if shown) now — they will not be shown again.",
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limit: err.limitKey }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to create webhook");
  }
}
