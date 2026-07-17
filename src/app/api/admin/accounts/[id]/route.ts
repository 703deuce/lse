import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { requireRecentAuth } from "@/lib/auth/reauth";
import { createServiceClient } from "@/lib/db/client";
import { type PlanId, resetOrganizationUsage, setOrganizationPlan } from "@/lib/plans";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRecentAuth();
    const auth = await requirePlatformAdmin();
    const { id } = await params;
    const body = (await request.json()) as {
      planId?: PlanId;
      outboundPaused?: boolean;
    };
    const meta = requestAuditMeta(request);

    if (typeof body.outboundPaused === "boolean") {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("organizations")
        .update({ outbound_paused: body.outboundPaused })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
      }
      await writeSecurityAuditEvent({
        action: "admin.outbound_pause",
        organizationId: id,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        resourceType: "organization",
        resourceId: id,
        meta: { outboundPaused: body.outboundPaused },
        ...meta,
      });
      return NextResponse.json({ ok: true, outboundPaused: body.outboundPaused });
    }

    if (!body.planId) {
      return NextResponse.json({ error: "planId or outboundPaused required" }, { status: 400 });
    }

    await setOrganizationPlan(id, body.planId);
    await writeSecurityAuditEvent({
      action: "admin.plan_change",
      organizationId: id,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization",
      resourceId: id,
      meta: { planId: body.planId },
      ...meta,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRecentAuth();
    const auth = await requirePlatformAdmin();
    const { id } = await params;
    const body = (await request.json()) as { action?: string };
    const meta = requestAuditMeta(request);
    const supabase = createServiceClient();

    if (body.action === "pause-outbound" || body.action === "resume-outbound") {
      const paused = body.action === "pause-outbound";
      const { error } = await supabase
        .from("organizations")
        .update({ outbound_paused: paused })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: "Request could not be completed" }, { status: 500 });
      }
      await writeSecurityAuditEvent({
        action: "admin.outbound_pause",
        organizationId: id,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        resourceType: "organization",
        resourceId: id,
        meta: { outboundPaused: paused },
        ...meta,
      });
      return NextResponse.json({ ok: true, outboundPaused: paused });
    }
    if (body.action !== "reset-usage") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    await resetOrganizationUsage(id);
    await writeSecurityAuditEvent({
      action: "admin.plan_change",
      organizationId: id,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization",
      resourceId: id,
      meta: { action: "reset-usage" },
      ...meta,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
