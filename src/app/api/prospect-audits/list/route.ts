import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";

export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = createServiceClient();

    const { data: prospects, error } = await supabase
      .from("businesses")
      .select(
        "id, name, address_text, scan_center_label, primary_category, prospect_status, archived_at, updated_at"
      )
      .eq("organization_id", auth.organizationId)
      .eq("account_type", "prospect")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const ids = (prospects ?? []).map((p) => p.id);
    const auditByBusiness = new Map<
      string,
      { id: string; status: string; keywords: string[] | null; updated_at: string | null }
    >();
    const keywordsByBusiness = new Map<string, string[]>();

    if (ids.length) {
      const { data: audits } = await supabase
        .from("prospect_audits")
        .select("id, business_id, status, keywords, updated_at, created_at")
        .in("business_id", ids)
        .order("created_at", { ascending: false });

      for (const row of audits ?? []) {
        const bid = String(row.business_id);
        if (auditByBusiness.has(bid)) continue;
        auditByBusiness.set(bid, {
          id: String(row.id),
          status: String(row.status ?? "idle"),
          keywords: (row.keywords as string[] | null) ?? null,
          updated_at: (row.updated_at as string | null) ?? null,
        });
      }

      const { data: kws } = await supabase
        .from("business_keywords")
        .select("business_id, keyword, is_primary, sort_order")
        .in("business_id", ids)
        .order("sort_order", { ascending: true });

      for (const kw of kws ?? []) {
        const bid = String(kw.business_id);
        const list = keywordsByBusiness.get(bid) ?? [];
        if (list.length >= 3) continue;
        const text = String(kw.keyword ?? "").trim();
        if (!text) continue;
        list.push(text);
        keywordsByBusiness.set(bid, list);
      }
    }

    const rows = (prospects ?? []).map((p) => {
      const audit = auditByBusiness.get(p.id);
      const rawStatus = audit?.status ?? "not_run";
      let auditStatus: "not_run" | "running" | "ready" | "failed" | "shared" = "not_run";
      if (rawStatus === "running" || rawStatus === "draft") auditStatus = "running";
      else if (rawStatus === "ready") auditStatus = "ready";
      else if (rawStatus === "shared") auditStatus = "shared";
      else if (rawStatus === "failed") auditStatus = "failed";
      else if (!audit) auditStatus = "not_run";
      else auditStatus = "not_run";

      const keywords =
        (audit?.keywords?.filter(Boolean) as string[] | undefined)?.slice(0, 3) ??
        keywordsByBusiness.get(p.id) ??
        [];

      return {
        id: p.id,
        name: p.name,
        address:
          (p.address_text as string | null)?.trim() ||
          (p.scan_center_label as string | null)?.trim() ||
          null,
        category: (p.primary_category as string | null) ?? null,
        prospectStatus: (p.prospect_status as string | null) ?? null,
        auditStatus,
        auditId: audit?.id ?? null,
        keywords,
        updatedAt: audit?.updated_at ?? (p.updated_at as string | null) ?? null,
      };
    });

    return NextResponse.json({ rows });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list prospect audits");
  }
}
