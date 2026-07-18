import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { generateShareToken, hashShareToken } from "@/lib/reporting/share-token";
import { hashSharePassword } from "@/lib/reporting/share-password";
import { trackProductEvent } from "@/lib/analytics/product-events";

const schema = z.object({
  businessId: z.string().uuid(),
  reportId: z.string().uuid(),
  password: z.union([z.string().min(4).max(128), z.literal(""), z.null()]).optional(),
  clearPassword: z.boolean().optional(),
  expiresAt: z.union([z.string().datetime(), z.literal(""), z.null()]).optional(),
  regenerate: z.boolean().optional(),
  publishStatus: z.enum(["draft", "published", "archived"]).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const reportId = url.searchParams.get("reportId");
    if (!businessId || !reportId) {
      return NextResponse.json({ error: "businessId and reportId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("reports")
      .select(
        "id, share_token, share_expires_at, share_password_hash, share_view_count, share_last_viewed_at, publish_status, metadata_json, generated_at"
      )
      .eq("id", reportId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      report: {
        id: data.id,
        shareUrl: data.share_token ? `${origin}/reports/share/${data.share_token}` : null,
        expiresAt: data.share_expires_at,
        hasPassword: Boolean(data.share_password_hash),
        viewCount: data.share_view_count ?? 0,
        lastViewedAt: data.share_last_viewed_at,
        publishStatus: data.publish_status ?? "published",
        metadata: data.metadata_json ?? {},
        generatedAt: data.generated_at,
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load share settings");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const p = parsed.data;
    const access = await requireBusinessAccess(p.businessId);
    await requireOrganizationPermission("report.share", access.organizationId);
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from("reports")
      .select("id, share_token, metadata_json")
      .eq("id", p.reportId)
      .eq("business_id", p.businessId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const patch: Record<string, unknown> = {};

    if (p.regenerate) {
      const token = generateShareToken();
      patch.share_token = token;
      patch.share_token_hash = hashShareToken(token);
      patch.share_view_count = 0;
      patch.share_last_viewed_at = null;
    }

    if (p.clearPassword) {
      patch.share_password_hash = null;
    } else if (p.password !== undefined) {
      if (!p.password) {
        patch.share_password_hash = null;
      } else {
        patch.share_password_hash = await hashSharePassword(p.password);
      }
    }

    if (p.expiresAt !== undefined) {
      patch.share_expires_at = p.expiresAt || null;
    }

    if (p.publishStatus !== undefined) {
      patch.publish_status = p.publishStatus;
    }

    const { data, error } = await supabase
      .from("reports")
      .update(patch)
      .eq("id", p.reportId)
      .eq("business_id", p.businessId)
      .select(
        "id, share_token, share_expires_at, share_password_hash, share_view_count, share_last_viewed_at, publish_status"
      )
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (p.publishStatus === "published") {
      trackProductEvent("report_published", {
        organizationId: access.organizationId,
        businessId: p.businessId,
        reportId: p.reportId,
      });
    }

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      report: {
        id: data!.id,
        shareUrl: data!.share_token ? `${origin}/reports/share/${data!.share_token}` : null,
        expiresAt: data!.share_expires_at,
        hasPassword: Boolean(data!.share_password_hash),
        viewCount: data!.share_view_count ?? 0,
        lastViewedAt: data!.share_last_viewed_at,
        publishStatus: data!.publish_status,
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update share settings");
  }
}
