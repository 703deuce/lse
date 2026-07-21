import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { queryLocalTrustOpportunities } from "@/lib/local-trust/engine";
import { createServiceClient } from "@/lib/db/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10");
    const opportunityType = url.searchParams.get("type") || null;
    const displayGroup = url.searchParams.get("group") || null;
    const priority = url.searchParams.get("priority") || null;
    const competitorPresent = url.searchParams.get("competitorPresent") === "true";
    const status = (url.searchParams.get("status") ?? "open") as "open" | "all";
    const marketCity = url.searchParams.get("marketCity") || null;
    const marketState = url.searchParams.get("marketState") || null;
    const allMarkets = url.searchParams.get("allMarkets") === "true";
    const runId = url.searchParams.get("runId") || null;

    const data = await queryLocalTrustOpportunities({
      businessId,
      page,
      pageSize,
      opportunityType,
      displayGroup,
      priority,
      competitorPresent: competitorPresent || undefined,
      status,
      marketCity,
      marketState,
      allMarkets,
      runId,
    });

    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load opportunities");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const body = await request.json();
    const runId = String(body.runId ?? "");
    const item = (body.item ?? {}) as Record<string, unknown>;
    const url = String(item.url ?? "").trim();
    if (!runId || !url) {
      return NextResponse.json({ error: "runId and item.url are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: run } = await supabase
      .from("local_trust_runs")
      .select("id, organization_id, business_id, city, state, county")
      .eq("id", runId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const domain =
      typeof item.domain === "string" && item.domain.trim()
        ? item.domain.trim()
        : (() => {
            try {
              return new URL(url).hostname.replace(/^www\./, "");
            } catch {
              return "";
            }
          })();

    const row = {
      run_id: runId,
      organization_id: auth.organizationId,
      business_id: businessId,
      title: String(item.title ?? (domain || url)),
      url,
      domain,
      opportunity_type: String(item.opportunityType ?? item.opportunity_type ?? "other"),
      city_match: Boolean(item.cityMatch ?? item.city_match),
      county_match: Boolean(item.countyMatch ?? item.county_match),
      topical_match: true,
      competitor_present: Boolean(item.competitorPresent ?? item.competitor_present),
      authority_score: Number(item.authorityScore ?? item.authority_score ?? 50),
      relevance_score: Number(item.localRelevance ?? item.relevanceScore ?? item.relevance_score ?? 50),
      difficulty: String(item.difficulty ?? "medium"),
      priority: String(item.priority ?? "medium"),
      suggested_action: String(item.suggestedAction ?? item.suggested_action ?? "Review and pursue this local trust opportunity."),
      evidence_snippet: String(item.reason ?? item.evidenceSnippet ?? ""),
      status: "open",
      raw_json: { restoredFromRejected: true, rejectedItem: item },
      market_city: run.city,
      market_state: run.state,
      market_county: run.county,
    };

    const { data, error } = await supabase
      .from("local_trust_opportunities")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    return httpErrorFromException(err, "Failed to add opportunity");
  }
}
