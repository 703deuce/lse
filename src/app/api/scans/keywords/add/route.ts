import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keyword } = body as { businessId?: string; keyword?: string };

    if (!businessId || !keyword?.trim()) {
      return NextResponse.json({ error: "businessId and keyword required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const trimmed = keyword.trim();

    const { data: existing } = await supabase
      .from("business_keywords")
      .select("id, keyword, city, state, is_primary")
      .eq("business_id", businessId);

    const duplicate = (existing ?? []).find(
      (k) => String(k.keyword).trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
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
    const message = err instanceof Error ? err.message : "Failed to add keyword";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
