import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keyword, campaignId } = body as {
      businessId?: string;
      keyword?: string;
      campaignId?: string;
    };

    if (!businessId || !keyword?.trim()) {
      return NextResponse.json({ error: "businessId and keyword required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const trimmed = keyword.trim();

    const { data: existing } = await supabase
      .from("business_keywords")
      .select("id, keyword, city, state, is_primary, campaign_id")
      .eq("business_id", businessId);

    const duplicate = (existing ?? []).find(
      (k) => String(k.keyword).trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      if (campaignId && !duplicate.campaign_id) {
        await supabase
          .from("business_keywords")
          .update({ campaign_id: campaignId })
          .eq("id", duplicate.id);
      }
      return NextResponse.json({
        keyword: { id: duplicate.id, keyword: String(duplicate.keyword).trim() },
        created: false,
      });
    }

    const primary = (existing ?? []).find((k) => k.is_primary) ?? existing?.[0];

    const { data: row, error } = await supabase
      .from("business_keywords")
      .insert({
        business_id: businessId,
        keyword: trimmed,
        city: primary?.city ?? null,
        state: primary?.state ?? null,
        is_primary: false,
        campaign_id: campaignId ?? null,
        active: true,
        sort_order: (existing ?? []).length,
      })
      .select("*")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message ?? "Failed to add keyword" }, { status: 500 });
    }

    return NextResponse.json({
      keyword: { id: row.id, keyword: String(row.keyword).trim() },
      created: true,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to add keyword");
  }
}
