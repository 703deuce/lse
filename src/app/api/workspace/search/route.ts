import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

/** Lightweight workspace search across prospects, clients, keywords, scans, reports. */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createServiceClient();
    const like = `%${q}%`;

    const { data: businesses } = await supabase
      .from("businesses")
      .select("id, name, account_type, is_tracked, archived_at")
      .eq("organization_id", auth.organizationId)
      .ilike("name", like)
      .limit(10);

    const businessIds = (businesses ?? []).map((b) => b.id as string);

    const [{ data: keywords }, { data: reports }] = await Promise.all([
      businessIds.length
        ? supabase
            .from("business_keywords")
            .select("id, keyword, business_id")
            .in("business_id", businessIds)
            .ilike("keyword", like)
            .limit(10)
        : Promise.resolve({ data: [] as { id: string; keyword: string; business_id: string }[] }),
      businessIds.length
        ? supabase
            .from("reports")
            .select("id, business_id, generated_at, artifact_kind")
            .in("business_id", businessIds)
            .order("generated_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const results = [
      ...(businesses ?? []).map((b) => ({
        type: b.account_type === "prospect" || b.is_tracked === false ? "prospect" : "client",
        id: b.id,
        label: b.name,
        href:
          b.account_type === "prospect" || b.is_tracked === false
            ? `/prospects/${b.id}`
            : `/clients/${b.id}`,
      })),
      ...(keywords ?? []).map((k) => ({
        type: "keyword",
        id: k.id,
        label: k.keyword,
        href: `/businesses/${k.business_id}/keywords`,
      })),
      ...(reports ?? []).map((r) => ({
        type: "report",
        id: r.id,
        label: `Report ${String(r.generated_at ?? "").slice(0, 10)}`,
        href: `/businesses/${r.business_id}/reports`,
      })),
    ];

    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (err) {
    return httpErrorFromException(err, "Search failed");
  }
}
