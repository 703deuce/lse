import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  listPendingContactMatches,
  resolveContactMatch,
} from "@/lib/integrations/webhook-contact-match";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const access = await requireBusinessAccess(businessId);
    await requireEntitlement(access.organizationId, "review_campaigns");

    const rows = await listPendingContactMatches({
      organizationId: access.organizationId,
      businessId,
    });

    return NextResponse.json({
      matches: rows.map((r) => ({
        id: r.id,
        eventId: r.event_id,
        endpointId: r.endpoint_id,
        reason: r.reason,
        candidates: r.candidate_contact_ids,
        incoming: {
          externalId: r.incoming_external_id,
          email: r.incoming_email,
          phone: r.incoming_phone,
          name: r.incoming_name,
        },
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to list matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      matchId?: string;
      action?: "link" | "skip";
      contactId?: string;
    };
    if (!body.businessId || !body.matchId || !body.action) {
      return NextResponse.json(
        { error: "businessId, matchId, and action are required" },
        { status: 400 }
      );
    }
    const access = await requireBusinessAccess(body.businessId);
    await requireEntitlement(access.organizationId, "review_campaigns");
    const auth = await requireAuth();

    const result = await resolveContactMatch({
      organizationId: access.organizationId,
      businessId: body.businessId,
      matchId: body.matchId,
      action: body.action,
      contactId: body.contactId,
      userId: auth.userId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Resolve failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, enrolled: result.enrolled ?? false });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to resolve match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
