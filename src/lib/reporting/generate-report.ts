import { createServiceClient } from "@/lib/db/client";
import { aggregateCompetitors, type AggregatedCompetitor } from "@/lib/maps/grid";
import { SCAN_RESULT_GRID_COLUMNS } from "@/lib/maps/scan-result-columns";
import { randomBytes } from "crypto";

export async function generateReport(params: {
  businessId: string;
  scanBatchId: string;
}): Promise<{ reportId: string; shareToken: string; html: string }> {
  const supabase = createServiceClient();

  const { data: existingReport } = await supabase
    .from("reports")
    .select("id, share_token, share_expires_at")
    .eq("scan_batch_id", params.scanBatchId)
    .eq("business_id", params.businessId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: business } = await supabase.from("businesses").select("*").eq("id", params.businessId).single();
  const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", params.scanBatchId).single();
  if (!business || !batch) throw new Error("Business or scan not found");
  if (batch.business_id !== params.businessId) {
    throw new Error("Scan does not belong to business");
  }

  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("*")
    .eq("business_id", business.id)
    .eq("is_primary", true)
    .maybeSingle();

  const { data: audit } = await supabase.from("audits").select("*").eq("scan_batch_id", params.scanBatchId).maybeSingle();

  const { data: actionPlan } = audit
    ? await supabase.from("action_plans").select("id").eq("audit_id", audit.id).maybeSingle()
    : { data: null };

  let actionItems: Array<{ title: string; description: string | null }> = [];
  if (actionPlan?.id) {
    const { data } = await supabase
      .from("action_items")
      .select("title, description")
      .eq("action_plan_id", actionPlan.id)
      .order("priority_rank")
      .limit(3);
    actionItems = data ?? [];
  }

  const { data: points } = await supabase.from("scan_points").select("id").eq("scan_batch_id", params.scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);
  let checkUrl: string | null = null;
  let topCompetitors: AggregatedCompetitor[] = [];
  if (pointIds.length) {
    const { data: results } = await supabase
      .from("scan_results")
      .select(SCAN_RESULT_GRID_COLUMNS)
      .in("scan_point_id", pointIds);
    checkUrl = results?.[0]?.check_url ?? null;
    topCompetitors = aggregateCompetitors(results ?? [], {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      targetCategory: business.primary_category,
      keyword: keywords?.keyword,
    }).slice(0, 5);
  }

  const metrics = (batch.aggregate_metrics ?? {}) as Record<string, number | null>;
  const confidence = (batch.confidence_summary ?? {}) as Record<string, unknown>;
  const generatedAt = new Date().toLocaleString();
  const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Reuse an active share token so existing links keep working; mint a new one
  // when the prior token was revoked or expired.
  const existingExpiresAt = existingReport?.share_expires_at
    ? new Date(existingReport.share_expires_at as string).getTime()
    : null;
  const existingExpired =
    existingExpiresAt !== null && Number.isFinite(existingExpiresAt) && existingExpiresAt <= Date.now();
  const shareToken =
    existingReport?.share_token && !existingExpired
      ? (existingReport.share_token as string)
      : randomBytes(16).toString("hex");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Maps Growth Report — ${escapeHtml(business.name)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.5rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
    .metric { display: inline-block; margin-right: 2rem; margin-bottom: 1rem; }
    .metric strong { display: block; font-size: 1.5rem; }
    ul { line-height: 1.6; }
    .footer { margin-top: 3rem; font-size: 0.75rem; color: #888; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    td, th { border-bottom: 1px solid #eee; padding: 0.5rem; text-align: left; }
  </style>
</head>
<body>
  <h1>${escapeHtml(business.name)} — Maps Visibility Report</h1>
  <div class="meta">
    Generated ${generatedAt} · Keyword: ${escapeHtml(keywords?.keyword ?? "—")} ·
    Grid: ${batch.grid_size}×${batch.grid_size} · Radius: ${batch.radius_meters}m ·
    Provider: DataForSEO (${batch.scan_type})
  </div>

  <section>
    <div class="metric"><strong>${metrics.averageRank ?? "—"}</strong>Avg rank</div>
    <div class="metric"><strong>${metrics.top3Cells ?? 0}</strong>Top 3 cells</div>
    <div class="metric"><strong>${metrics.top10Cells ?? 0}</strong>Top 10 cells</div>
    <div class="metric"><strong>${metrics.top20Cells ?? 0}</strong>Top 20 cells</div>
    <div class="metric"><strong>${metrics.visibilityScore ?? 0}%</strong>Visibility</div>
  </section>

  <section><h2>Proof & confidence</h2>
  <p>Depersonalized location-based benchmark. Failed cells: ${String(confidence.failed_cells ?? 0)}.</p>
  ${checkUrl ? `<p><a href="${escapeHtml(checkUrl)}">Verify on Google Maps</a></p>` : ""}
  </section>

  ${topCompetitors.length ? `<section><h2>Top competitors (same category · top-3 pack)</h2><table>
  <tr><th>Business</th><th>Top-3 cells</th><th>Avg rank in pack</th></tr>
  ${topCompetitors.map((c) => `<tr><td>${escapeHtml(c.name ?? "Unknown")}</td><td>${c.top3Appearances}/${c.totalCells}</td><td>#${c.avgTop3Rank}</td></tr>`).join("")}
  </table></section>` : ""}

  ${audit ? `<section><h2>Audit scores</h2>
  <p>Overall: ${audit.overall_score}/100 · Relevance: ${audit.relevance_score} · Distance: ${audit.distance_score} · Prominence: ${audit.prominence_score} · Trust: ${audit.trust_score}</p></section>` : ""}

  <section><h2>Top 3 actions this week</h2><ul>
    ${actionItems.map((a) => `<li><strong>${escapeHtml(a.title)}</strong> — ${escapeHtml(a.description ?? "")}</li>`).join("")}
  </ul></section>

  <div class="footer">Maps Growth Agent · Not a personalized result for every searcher</div>
</body>
</html>`;

  const metadata = {
    generatedAt,
    keyword: keywords?.keyword,
    checkUrl,
    provider: "dataforseo",
  };

  if (existingReport?.id) {
    const { data: report, error } = await supabase
      .from("reports")
      .update({
        share_token: shareToken,
        share_expires_at: shareExpiresAt,
        html_content: html,
        metadata_json: metadata,
        generated_at: new Date().toISOString(),
      })
      .eq("id", existingReport.id)
      .eq("business_id", params.businessId)
      .select("id")
      .single();
    if (error || !report) throw new Error(error?.message ?? "Failed to update report");
    return { reportId: report.id, shareToken, html };
  }

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      business_id: params.businessId,
      scan_batch_id: params.scanBatchId,
      share_token: shareToken,
      share_expires_at: shareExpiresAt,
      html_content: html,
      metadata_json: metadata,
    })
    .select("id")
    .single();

  if (error || !report) throw new Error(error?.message ?? "Failed to create report");
  return { reportId: report.id, shareToken, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
