import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { httpErrorFromException } from "@/lib/security/http-errors";

/**
 * List reports for an org or a single business, grouped by publish_status.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const supabase = createServiceClient();

    let businessIds: string[] = [];
    let bizNames = new Map<string, string>();

    if (businessId) {
      await requireBusinessAccess(businessId);
      businessIds = [businessId];
      const { data: b } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("id", businessId)
        .maybeSingle();
      if (b) bizNames.set(b.id as string, b.name as string);
    } else {
      const auth = await requireAuth();
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("organization_id", auth.organizationId)
        .is("archived_at", null)
        .limit(120);
      businessIds = (businesses ?? []).map((b) => b.id as string);
      bizNames = new Map((businesses ?? []).map((b) => [b.id as string, b.name as string]));
    }

    if (!businessIds.length) {
      return NextResponse.json({
        drafts: [],
        published: [],
        readyToReview: [],
        archived: [],
        recentlyViewed: [],
        all: [],
      });
    }

    const { data: rows } = await supabase
      .from("reports")
      .select(
        "id, business_id, report_type, publish_status, share_token, generated_at, updated_at, share_last_viewed_at, metadata_json"
      )
      .in("business_id", businessIds)
      .order("generated_at", { ascending: false })
      .limit(120);

    const mapped = (rows ?? []).map((r) => {
      const meta = (r.metadata_json ?? {}) as { title?: string };
      const typeLabel = String(r.report_type ?? "report").replace(/_/g, " ");
      const bizName = bizNames.get(r.business_id as string) ?? "Client";
      return {
        id: r.id as string,
        businessId: r.business_id as string,
        businessName: bizName,
        title: meta.title?.trim() || `${typeLabel} — ${bizName}`,
        reportType: r.report_type as string | null,
        publishStatus: (r.publish_status as string) ?? "published",
        shareToken: r.share_token as string | null,
        createdAt: r.generated_at as string | null,
        updatedAt: (r.updated_at as string | null) ?? (r.generated_at as string | null),
        viewedAt: r.share_last_viewed_at as string | null,
        href: `/reports/${r.id}`,
      };
    });

    const drafts = mapped.filter((r) => r.publishStatus === "draft");
    const archived = mapped.filter((r) => r.publishStatus === "archived");
    const published = mapped.filter((r) => r.publishStatus === "published");
    const readyToReview = drafts;
    const recentlyViewed = mapped
      .filter((r) => r.viewedAt)
      .sort((a, b) => String(b.viewedAt).localeCompare(String(a.viewedAt)))
      .slice(0, 12);

    return NextResponse.json({
      drafts,
      published,
      readyToReview,
      archived,
      recentlyViewed,
      all: mapped,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list reports");
  }
}
