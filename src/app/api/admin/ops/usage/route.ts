import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/db/client";

/**
 * Admin cost/usage rollup from usage_ledger (migration 045).
 * Optional filters: organizationId, billingPeriod (YYYY-MM).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (!isAdminEmail(auth.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    const billingPeriod =
      url.searchParams.get("billingPeriod") ?? new Date().toISOString().slice(0, 7);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

    const supabase = createServiceClient();
    let query = supabase
      .from("usage_ledger")
      .select(
        "id, organization_id, business_id, feature, provider, unit_type, actual_units, estimated_cost_usd, actual_cost_usd, billing_period, created_at"
      )
      .eq("billing_period", billingPeriod)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: "Ensure migration 045 (usage_ledger) is applied" },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const byOrg = new Map<
      string,
      { organizationId: string; estimatedCostUsd: number; actualCostUsd: number; units: number; rows: number }
    >();
    const byProvider = new Map<string, { provider: string; estimatedCostUsd: number; units: number }>();

    for (const row of rows) {
      const orgId = String(row.organization_id);
      const est = Number(row.estimated_cost_usd ?? 0) || 0;
      const act = Number(row.actual_cost_usd ?? row.estimated_cost_usd ?? 0) || 0;
      const units = Number(row.actual_units ?? 0) || 0;
      const org = byOrg.get(orgId) ?? {
        organizationId: orgId,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        units: 0,
        rows: 0,
      };
      org.estimatedCostUsd += est;
      org.actualCostUsd += act;
      org.units += units;
      org.rows += 1;
      byOrg.set(orgId, org);

      const provider = String(row.provider ?? "unknown");
      const p = byProvider.get(provider) ?? { provider, estimatedCostUsd: 0, units: 0 };
      p.estimatedCostUsd += est;
      p.units += units;
      byProvider.set(provider, p);
    }

    return NextResponse.json({
      billingPeriod,
      organizationId: organizationId ?? null,
      totals: {
        estimatedCostUsd: [...byOrg.values()].reduce((s, o) => s + o.estimatedCostUsd, 0),
        actualCostUsd: [...byOrg.values()].reduce((s, o) => s + o.actualCostUsd, 0),
        units: [...byOrg.values()].reduce((s, o) => s + o.units, 0),
        rowCount: rows.length,
      },
      byOrganization: [...byOrg.values()].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
      byProvider: [...byProvider.values()].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd),
      recent: rows.slice(0, 25),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
