import { NextResponse } from "next/server";
import { httpErrorFromException, httpEntitlementError } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { requireEntitlement } from "@/lib/auth/entitlements";
import { createServiceClient } from "@/lib/db/client";
import {
  buildIncomingWebhookUrl,
  getWebhookEndpoint,
  revokeWebhookEndpoint,
  rotateEndpointToken,
  rotateSigningSecret,
  updateWebhookEndpoint,
} from "@/lib/integrations/webhook-endpoints";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

async function authEndpoint(request: Request, endpointId: string) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) throw new Error("businessId required");
  const access = await requireBusinessAccess(businessId);
  await requireEntitlement(access.organizationId, "review_campaigns");
  const endpoint = await getWebhookEndpoint({
    organizationId: access.organizationId,
    endpointId,
  });
  if (!endpoint) throw new Error("Endpoint not found");
  const endpointBusiness =
    endpoint.business_id ?? endpoint.default_business_id ?? null;
  if (!endpointBusiness || endpointBusiness !== businessId) {
    throw new Error("Endpoint not found");
  }
  return { access, endpoint, businessId };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ endpointId: string }> }
) {
  try {
    const { endpointId } = await params;
    const { access, endpoint } = await authEndpoint(request, endpointId);
    const supabase = createServiceClient();
    const { data: events } = await supabase
      .from("integration_webhook_events")
      .select(
        "id, external_event_id, event_type, status, received_at, processed_at, customer_safe_error, contact_id, campaign_enrollment_id, request_id, payload_normalized"
      )
      .eq("endpoint_id", endpointId)
      .eq("organization_id", access.organizationId)
      .order("received_at", { ascending: false })
      .limit(50);

    const samplePayload = {
      event_id: "job_example_completed",
      event_type: endpoint.default_event_type,
      occurred_at: new Date().toISOString(),
      customer: {
        external_id: "customer_123",
        first_name: "Anthony",
        last_name: "Johnson",
        email: "customer@example.com",
        phone: "+15555550123",
      },
      transaction: {
        external_id: "job_example",
        type: "service",
        completed_at: new Date().toISOString(),
      },
      consent: { email: true, sms: true },
    };

    return NextResponse.json({
      endpoint: {
        id: endpoint.id,
        name: endpoint.name,
        description: endpoint.description,
        businessId: endpoint.business_id ?? endpoint.default_business_id,
        campaignId: endpoint.campaign_id ?? endpoint.default_campaign_id,
        eventType: endpoint.default_event_type,
        allowedEventTypes: endpoint.allowed_event_types,
        isTest: endpoint.is_test,
        isActive: endpoint.is_active,
        signatureRequired: endpoint.signature_required,
        tokenLastFour: endpoint.endpoint_token_last_four,
        sendDelayMinutes: endpoint.send_delay_minutes,
        duplicateWindowDays: endpoint.duplicate_window_days,
        fieldMapping: endpoint.field_mapping,
        lastReceivedAt: endpoint.last_received_at,
        lastSuccessAt: endpoint.last_success_at,
        lastFailureAt: endpoint.last_failure_at,
        createdAt: endpoint.created_at,
        hasSigningSecret: Boolean(endpoint.signing_secret_encrypted),
      },
      events: events ?? [],
      samplePayload,
      // URL not reconstructable without raw token — show placeholder pattern.
      webhookUrlHint: `…/api/integrations/webhooks/incoming/lsewh_…${endpoint.endpoint_token_last_four}`,
    });
  } catch (err) {
    const ent = httpEntitlementError(err);
    if (ent) return ent;
    const message = err instanceof Error ? err.message : "";
    const status = message.includes("not found") ? 404 : message.includes("required") ? 400 : 500;
    if (status !== 500) {
      return NextResponse.json(
        { error: status === 404 ? "Not found" : message.includes("required") ? message : "Bad request" },
        { status }
      );
    }
    return httpErrorFromException(err, "Failed to load endpoint");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ endpointId: string }> }
) {
  try {
    const { endpointId } = await params;
    const { access, endpoint } = await authEndpoint(request, endpointId);
    await requireRecentAuth();
    const permAuth = await requireOrganizationPermission(
      "integration.manage",
      access.organizationId
    );
    const auditMeta = requestAuditMeta(request);
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      isActive?: boolean;
      isTest?: boolean;
      sendDelayMinutes?: number;
      fieldMapping?: Record<string, string>;
    };

    if (body.action === "rotate_url") {
      const rotated = await rotateEndpointToken({
        organizationId: access.organizationId,
        endpointId,
      });
      await writeSecurityAuditEvent({
        action: "integration.webhook.rotate",
        organizationId: access.organizationId,
        actorUserId: permAuth.userId,
        actorEmail: permAuth.email,
        resourceType: "integration_webhook_endpoint",
        resourceId: endpointId,
        meta: { kind: "url" },
        ...auditMeta,
      });
      return NextResponse.json({
        webhookUrl: buildIncomingWebhookUrl(rotated.rawToken),
        rawToken: rotated.rawToken,
        warning: "Copy the new URL now. Old URL remains valid for 24 hours.",
      });
    }
    if (body.action === "rotate_secret") {
      const rotated = await rotateSigningSecret({
        organizationId: access.organizationId,
        endpointId,
      });
      await writeSecurityAuditEvent({
        action: "integration.webhook.rotate",
        organizationId: access.organizationId,
        actorUserId: permAuth.userId,
        actorEmail: permAuth.email,
        resourceType: "integration_webhook_endpoint",
        resourceId: endpointId,
        meta: { kind: "secret" },
        ...auditMeta,
      });
      return NextResponse.json({
        signingSecret: rotated.signingSecret,
        warning: "Copy the signing secret now — it will not be shown again.",
      });
    }
    if (body.action === "revoke") {
      await revokeWebhookEndpoint({
        organizationId: access.organizationId,
        endpointId,
      });
      await writeSecurityAuditEvent({
        action: "integration.webhook.delete",
        organizationId: access.organizationId,
        actorUserId: permAuth.userId,
        actorEmail: permAuth.email,
        resourceType: "integration_webhook_endpoint",
        resourceId: endpointId,
        ...auditMeta,
      });
      return NextResponse.json({ ok: true });
    }

    // Promoting to live requires a healthy campaign target.
    if (body.isTest === false) {
      const campaignId = endpoint.campaign_id ?? endpoint.default_campaign_id;
      if (!campaignId) {
        return NextResponse.json(
          { error: "Assign an active campaign before promoting to live" },
          { status: 400 }
        );
      }
      const supabase = createServiceClient();
      const { data: campaign } = await supabase
        .from("review_request_campaigns")
        .select("id, status")
        .eq("id", campaignId)
        .eq("organization_id", access.organizationId)
        .maybeSingle();
      if (!campaign || !["active", "scheduled"].includes(String(campaign.status))) {
        return NextResponse.json(
          {
            error: `Campaign must be active or scheduled before going live (currently ${campaign?.status ?? "missing"}).`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await updateWebhookEndpoint({
      organizationId: access.organizationId,
      endpointId,
      patch: {
        name: body.name,
        is_active: body.isActive,
        is_test: body.isTest,
        send_delay_minutes: body.sendDelayMinutes,
        field_mapping: body.fieldMapping,
      },
    });
    return NextResponse.json({
      endpoint: {
        id: updated.id,
        name: updated.name,
        isTest: updated.is_test,
        isActive: updated.is_active,
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update endpoint");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ endpointId: string }> }
) {
  try {
    const { endpointId } = await params;
    const { access } = await authEndpoint(request, endpointId);
    await requireRecentAuth();
    const permAuth = await requireOrganizationPermission(
      "integration.manage",
      access.organizationId
    );
    await revokeWebhookEndpoint({
      organizationId: access.organizationId,
      endpointId,
    });
    const auditMeta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "integration.webhook.delete",
      organizationId: access.organizationId,
      actorUserId: permAuth.userId,
      actorEmail: permAuth.email,
      resourceType: "integration_webhook_endpoint",
      resourceId: endpointId,
      ...auditMeta,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Failed to delete endpoint");
  }
}
