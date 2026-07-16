import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const url = new URL(request.url);
    const checkId = url.searchParams.get("checkId");
    const locationId = url.searchParams.get("locationId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    if (checkId) {
      const { data, error } = await supabase
        .from("single_point_rank_checks")
        .select("*")
        .eq("id", checkId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: "Check not found" }, { status: 404 });
      }
      return NextResponse.json({ check: data });
    }

    let query = supabase
      .from("single_point_rank_checks")
      .select("*")
      .eq("business_id", businessId)
      .order("checked_at", { ascending: false })
      .limit(limit);

    if (locationId === "null" || locationId === "") {
      query = query.is("location_id", null);
    } else if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ checks: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load checks";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
