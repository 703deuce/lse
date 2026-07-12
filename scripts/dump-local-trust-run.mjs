/**
 * Dump latest local trust run opportunities + rejections.
 * Usage: node scripts/dump-local-trust-run.mjs [businessId]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const businessId = process.argv[2] ?? "94211cfb-02f3-401b-a459-39516871c8bf";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: run } = await sb
  .from("local_trust_runs")
  .select("id, opportunities_found, filtered_out_count, created_at, finished_at, status, ai_json")
  .eq("business_id", businessId)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!run) {
  console.log(JSON.stringify({ error: "No run found" }));
  process.exit(1);
}

const { data: opps } = await sb
  .from("local_trust_opportunities")
  .select("title, url, domain, opportunity_type, priority, relevance_score, evidence_snippet, raw_json")
  .eq("run_id", run.id)
  .order("relevance_score", { ascending: false });

const rejected = run.ai_json?.rejected_opportunities ?? [];

console.log(
  JSON.stringify(
    {
      runId: run.id,
      status: run.status,
      finishedAt: run.finished_at,
      opportunitiesFound: run.opportunities_found,
      filteredOut: run.filtered_out_count,
      accepted: (opps ?? []).map((o) => ({
        title: o.title,
        url: o.url,
        domain: o.domain,
        type: o.opportunity_type,
        group: o.raw_json?.displayGroup,
        priority: o.priority,
        score: o.relevance_score,
        reason: o.evidence_snippet,
        alternateUrls: o.raw_json?.alternateUrls,
      })),
      rejected: rejected.map((r) => ({
        title: r.title,
        url: r.url,
        domain: r.domain,
        stage: r.stage,
        reason: r.reason,
        type: r.opportunityType,
        confidence: r.confidence,
        localRelevance: r.localRelevance,
      })),
    },
    null,
    2
  )
);
