import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { requireRecentAuth } from "@/lib/auth/reauth";
import {
  createOrganizationApiKey,
  listOrganizationApiKeys,
  revokeOrganizationApiKey,
} from "@/lib/auth/api-keys";
import { appUrl } from "@/lib/app-url";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requestAuditMeta, writeSecurityAuditEvent } from "@/lib/security/audit-log";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const access = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("api_key.manage", access.organizationId);
    const keys = await listOrganizationApiKeys(access.organizationId);
    return NextResponse.json({
      keys,
      webhookUrl: appUrl("/api/webhooks/automation"),
    });
  } catch (err) {
    return httpErrorFromException(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      name?: string;
      scopeToBusiness?: boolean;
    };
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireRecentAuth();
    const access = await requireBusinessAccess(body.businessId);
    const auth = await requireOrganizationPermission("api_key.manage", access.organizationId);
    const created = await createOrganizationApiKey({
      organizationId: access.organizationId,
      businessId: body.scopeToBusiness ? body.businessId : null,
      name: body.name,
      createdBy: auth.userId,
    });
    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "api_key.create",
      organizationId: access.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization_api_key",
      resourceId: created.key.id,
      ...meta,
    });
    return NextResponse.json({
      key: created.key,
      rawKey: created.raw,
      webhookUrl: appUrl("/api/webhooks/automation"),
      warning: "Copy this key now — it will not be shown again.",
    });
  } catch (err) {
    return httpErrorFromException(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const keyId = url.searchParams.get("keyId");
    if (!businessId || !keyId) {
      return NextResponse.json({ error: "businessId and keyId required" }, { status: 400 });
    }
    await requireRecentAuth();
    const access = await requireBusinessAccess(businessId);
    const auth = await requireOrganizationPermission("api_key.manage", access.organizationId);
    const ok = await revokeOrganizationApiKey({
      organizationId: access.organizationId,
      keyId,
    });
    if (!ok) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    const meta = requestAuditMeta(request);
    await writeSecurityAuditEvent({
      action: "api_key.revoke",
      organizationId: access.organizationId,
      actorUserId: auth.userId,
      actorEmail: auth.email,
      resourceType: "organization_api_key",
      resourceId: keyId,
      ...meta,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err);
  }
}
