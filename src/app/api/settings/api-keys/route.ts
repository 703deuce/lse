import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import {
  createOrganizationApiKey,
  listOrganizationApiKeys,
  revokeOrganizationApiKey,
} from "@/lib/auth/api-keys";
import { appUrl } from "@/lib/app-url";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const access = await requireBusinessAccess(businessId);
    const keys = await listOrganizationApiKeys(access.organizationId);
    return NextResponse.json({
      keys,
      webhookUrl: appUrl("/api/webhooks/automation"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list API keys";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
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
    const access = await requireBusinessAccess(body.businessId);
    const auth = await requireAuth();
    const created = await createOrganizationApiKey({
      organizationId: access.organizationId,
      businessId: body.scopeToBusiness ? body.businessId : null,
      name: body.name,
      createdBy: auth.userId,
    });
    return NextResponse.json({
      key: created.key,
      rawKey: created.raw,
      webhookUrl: appUrl("/api/webhooks/automation"),
      warning: "Copy this key now — it will not be shown again.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create API key";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
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
    const access = await requireBusinessAccess(businessId);
    const ok = await revokeOrganizationApiKey({
      organizationId: access.organizationId,
      keyId,
    });
    if (!ok) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revoke API key";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
