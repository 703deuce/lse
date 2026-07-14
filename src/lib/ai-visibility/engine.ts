import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { formatSearchLocation, parseUsAddressCityState } from "@/lib/geo/us-address";
import { loadCompetitorsForBusiness } from "@/lib/audit/run-audit";
import { getPlanLimits } from "@/lib/ai-visibility/limits";
import { buildPrimaryPrompt, fallbackSuggestedPrompts } from "@/lib/ai-visibility/prompts";
import { computeVisibilityScore } from "@/lib/ai-visibility/extract";
import type { AiEngine, AiVisibilityRunResult, EngineResult } from "@/lib/ai-visibility/types";
import { DEFAULT_ENGINES } from "@/lib/ai-visibility/types";
import {
  generateAiVisibilityPrompts,
  generateAiVisibilitySummary,
} from "@/lib/providers/deepseek/ai-visibility-prompts";
import { extractMentionsFromResponse } from "@/lib/providers/deepseek/ai-visibility-mentions";
import {
  buildAggregateMetrics,
  buildHistoricalMentions,
  buildMentionLeaderboard,
  buildMentionSearchRecords,
  buildVisibilityTrend,
  collectFanouts,
  collectSources,
  countUniqueCompanies,
} from "@/lib/ai-visibility/mentions";
import { fetchGoogleSerpSnapshot, type MapPackEntry, type OrganicSerpEntry } from "@/lib/providers/scrapingdog/google-serp-snapshot";
import { deduplicateMentionClusters } from "@/lib/providers/deepseek/ai-visibility-mention-dedupe";
import { matchAiMentionsToGoogleSerp, type SerpMatchRow } from "@/lib/providers/deepseek/ai-visibility-serp-match";
import { checkAiEngine } from "@/lib/ai-visibility/engines";

async function loadBusinessContext(businessId: string) {
  const supabase = createServiceClient();
  const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).single();
  if (!business) throw new Error("Business not found");

  const { data: org } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", business.organization_id)
    .single();

  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("keyword, city, state, is_primary")
    .eq("business_id", businessId);
  const primary = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

  const fromAddress = parseUsAddressCityState(business.address_text);
  const city = primary?.city?.trim() || fromAddress.city || "";
  const state = primary?.state?.trim() || fromAddress.state || "";
  const category = (business.primary_category as string) ?? "local business";
  const lat =
    (business.scan_center_lat as number | null) ??
    (business.lat as number | null) ??
    null;
  const lng =
    (business.scan_center_lng as number | null) ??
    (business.lng as number | null) ??
    null;
  const searchLocation = city && state ? formatSearchLocation(city, state) : null;

  return {
    business,
    organizationId: business.organization_id as string,
    plan: (org?.plan as string) ?? "starter",
    city,
    state,
    category,
    primaryKeyword: primary?.keyword ?? category,
    services: ((business.services as string[]) ?? []).filter(Boolean),
    lat,
    lng,
    searchLocation,
  };
}

export async function ensurePrimaryPrompt(params: {
  businessId: string;
  organizationId: string;
  regenerate?: boolean;
}) {
  const supabase = createServiceClient();
  const ctx = await loadBusinessContext(params.businessId);

  if (!ctx.city || !ctx.state) {
    throw new Error("City and state required for AI visibility prompts.");
  }

  const { data: existingPrimary } = await supabase
    .from("ai_visibility_prompts")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("is_primary", true)
    .maybeSingle();

  if (existingPrimary && !params.regenerate) {
    return loadAiVisibilityData(params.businessId);
  }

  const competitors = await loadCompetitorsForBusiness(params.businessId);
  if (existingPrimary) {
    await supabase.from("ai_visibility_prompts").delete().eq("business_id", params.businessId);
  }

  const primaryPromptText = buildPrimaryPrompt({
    category: ctx.category,
    city: ctx.city,
    state: ctx.state,
  });

  await supabase.from("ai_visibility_prompts").insert({
    organization_id: params.organizationId,
    business_id: params.businessId,
    prompt_text: primaryPromptText,
    status: "active",
    is_primary: true,
    category: ctx.category,
    intent_type: "primary",
    opportunity_score: 5,
    reason: "Primary buyer prompt for AI visibility baseline",
    engines: DEFAULT_ENGINES,
  });

  const fallbackSuggested = fallbackSuggestedPrompts({
    category: ctx.category,
    city: ctx.city,
    state: ctx.state,
    services: ctx.services,
  });

  const suggestedRows = fallbackSuggested.map((s) => ({
    organization_id: params.organizationId,
    business_id: params.businessId,
    prompt_text: s.prompt,
    status: "suggested",
    is_primary: false,
    category: s.category,
    intent_type: s.intent_type,
    opportunity_score: s.opportunity_score,
    reason: s.reason,
    engines: DEFAULT_ENGINES,
  }));

  if (suggestedRows.length) {
    await supabase.from("ai_visibility_prompts").insert(suggestedRows);
  }

  void enrichSuggestionsWithAi({
    businessId: params.businessId,
    organizationId: params.organizationId,
    businessName: ctx.business.name as string,
    category: ctx.category,
    city: ctx.city,
    state: ctx.state,
    services: ctx.services,
    competitors: competitors.map((c) => c.name),
  }).catch(() => {});

  return loadAiVisibilityData(params.businessId);
}

async function enrichSuggestionsWithAi(params: {
  businessId: string;
  organizationId: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  services: string[];
  competitors: string[];
}) {
  const generated = await generateAiVisibilityPrompts({
    organizationId: params.organizationId,
    businessName: params.businessName,
    category: params.category,
    city: params.city,
    state: params.state,
    services: params.services,
    competitors: params.competitors,
    promptCount: 1,
  });

  if (!generated.suggestedPrompts.length) return;

  const supabase = createServiceClient();
  await supabase
    .from("ai_visibility_prompts")
    .delete()
    .eq("business_id", params.businessId)
    .eq("status", "suggested");

  await supabase.from("ai_visibility_prompts").insert(
    generated.suggestedPrompts.map((s) => ({
      organization_id: params.organizationId,
      business_id: params.businessId,
      prompt_text: s.prompt,
      status: "suggested",
      is_primary: false,
      category: s.category,
      intent_type: s.intent_type,
      opportunity_score: s.opportunity_score,
      reason: s.reason,
      engines: DEFAULT_ENGINES,
    }))
  );
}

export async function loadAiVisibilityData(businessId: string, selectedRunId?: string | null) {
  const supabase = createServiceClient();
  const ctx = await loadBusinessContext(businessId);
  const limits = getPlanLimits(ctx.plan);

  const [promptsRes, allRunsRes, activeCountRes] = await Promise.all([
    supabase
      .from("ai_visibility_prompts")
      .select("*")
      .eq("business_id", businessId)
      .neq("status", "archived")
      .order("is_primary", { ascending: false })
      .order("opportunity_score", { ascending: false }),
    supabase
      .from("ai_visibility_runs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("ai_visibility_prompts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active"),
  ]);

  const prompts = promptsRes.data ?? [];
  const allRuns = allRunsRes.data ?? [];
  const latestComplete = allRuns.find((r) => r.status === "complete") ?? null;
  // Prefer a complete run for default view so failed/running blanks don't wipe engine chips.
  const latestRun = latestComplete ?? allRuns[0] ?? null;
  const completeRuns = allRuns.filter((r) => r.status === "complete");
  const recentRuns = completeRuns.slice(0, 50);

  const viewRun =
    selectedRunId && selectedRunId !== "combined"
      ? allRuns.find((r) => r.id === selectedRunId) ?? latestRun
      : selectedRunId === "combined"
        ? null
        : latestRun;

  let engineResults: Record<string, unknown>[] = [];
  let allHistoricalEngineResults: Record<string, unknown>[] = [];

  if (viewRun?.id) {
    const { data } = await supabase
      .from("ai_visibility_engine_results")
      .select("*")
      .eq("run_id", viewRun.id)
      .order("checked_at", { ascending: true });
    engineResults = data ?? [];
  }

  if (recentRuns.length) {
    const runIds = recentRuns.map((r) => r.id);
    const { data } = await supabase
      .from("ai_visibility_engine_results")
      .select("run_id, engine, status, target_mentioned, mentions_json, sources_json, checked_at")
      .in("run_id", runIds);
    allHistoricalEngineResults = data ?? [];
  }

  const runAtById = new Map(allRuns.map((r) => [r.id as string, r.created_at as string]));

  const engineResultsByRun = new Map<string, Array<{ mentions_json?: EngineResult["brandMentions"] }>>();
  for (const er of allHistoricalEngineResults) {
    const runId = er.run_id as string;
    const list = engineResultsByRun.get(runId) ?? [];
    list.push({ mentions_json: (er.mentions_json as EngineResult["brandMentions"]) ?? [] });
    engineResultsByRun.set(runId, list);
  }

  const runs = allRuns.map((run) => ({
    id: run.id as string,
    status: run.status as string,
    visibility_score: run.visibility_score as number | null,
    target_mentioned: run.target_mentioned as boolean | null,
    mention_position: run.mention_position as number | null,
    competitor_count: (run.competitor_count as number) ?? 0,
    sources_count: (run.sources_count as number) ?? 0,
    fanouts_count: (run.fanouts_count as number) ?? 0,
    prompts_checked: (run.prompts_checked as number) ?? 0,
    engines_checked: (run.engines_checked as number) ?? 0,
    ai_summary: run.ai_summary as string | null,
    created_at: run.created_at as string,
    finished_at: run.finished_at as string | null,
    companyCount: countUniqueCompanies(engineResultsByRun.get(run.id as string) ?? []),
    enginesMentioningYou: allHistoricalEngineResults
      .filter((er) => er.run_id === run.id && er.target_mentioned)
      .map((er) => er.engine as AiEngine),
  }));

  const aggregateMetrics = buildAggregateMetrics({
    runs: allRuns.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      created_at: r.created_at as string,
      finished_at: r.finished_at as string | null,
    })),
    engineResults: allHistoricalEngineResults.map((er) => ({
      run_id: er.run_id as string,
      engine: er.engine as AiEngine,
      status: er.status as string,
      target_mentioned: er.target_mentioned as boolean,
      mentions_json: (er.mentions_json as EngineResult["brandMentions"]) ?? [],
    })),
    totalEngines: limits.engines.length,
  });

  const visibilityTrend = buildVisibilityTrend({
    runs: completeRuns.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      visibility_score: r.visibility_score as number | null,
      target_mentioned: r.target_mentioned as boolean | null,
      engines_checked: (r.engines_checked as number) ?? 0,
      created_at: r.created_at as string,
    })),
    engineResultsByRun,
  });

  const mentionLeaderboard = buildMentionLeaderboard({
    engineResults: engineResults.map((er) => ({
      engine: er.engine as AiEngine,
      mentions_json: (er.mentions_json as EngineResult["brandMentions"]) ?? [],
    })),
  });

  const historicalMentions = buildHistoricalMentions({
    runs: recentRuns.map((r) => ({ id: r.id as string, created_at: r.created_at as string })),
    engineResults: allHistoricalEngineResults.map((er) => ({
      run_id: er.run_id as string,
      mentions_json: (er.mentions_json as EngineResult["brandMentions"]) ?? [],
    })),
  });

  const allSources = collectSources(
    engineResults.map((er) => ({
      engine: er.engine as AiEngine,
      sources_json: er.sources_json as Array<{ url?: string; label?: string; position?: number }>,
    }))
  );

  const allFanouts = collectFanouts(
    engineResults.map((er) => ({
      engine: er.engine as AiEngine,
      fanouts_json: er.fanouts_json as string[],
    }))
  );

  const { data: allPromptResults } = await supabase
    .from("ai_visibility_engine_results")
    .select("prompt_id, checked_at, target_mentioned")
    .eq("business_id", businessId)
    .order("checked_at", { ascending: false });

  const promptLastRun = new Map<string, string>();
  const promptMentionRuns = new Map<string, number>();
  for (const er of allPromptResults ?? []) {
    const pid = er.prompt_id as string;
    const at = er.checked_at as string;
    if (!promptLastRun.has(pid)) promptLastRun.set(pid, at);
    if (er.target_mentioned) {
      promptMentionRuns.set(pid, (promptMentionRuns.get(pid) ?? 0) + 1);
    }
  }

  const runningRun = allRuns.find((r) => r.status === "running") ?? null;
  const displayRun = viewRun ?? latestRun;
  const isCombinedView = selectedRunId === "combined";
  const viewMode: "combined" | "run" = isCombinedView
    ? "combined"
    : selectedRunId || displayRun
      ? "run"
      : "combined";

  const searchEngineRows = isCombinedView
    ? allHistoricalEngineResults.map((er) => ({
        run_id: er.run_id as string,
        run_at: runAtById.get(er.run_id as string) ?? (er.checked_at as string),
        engine: er.engine as AiEngine,
        mentions_json: (er.mentions_json as EngineResult["brandMentions"]) ?? [],
        sources_json: er.sources_json as Array<{ url?: string; label?: string; position?: number }>,
      }))
    : engineResults.map((er) => ({
        run_id: (displayRun?.id as string) ?? "",
        run_at: (displayRun?.created_at as string) ?? (er.checked_at as string),
        engine: er.engine as AiEngine,
        mentions_json: (er.mentions_json as EngineResult["brandMentions"]) ?? [],
        sources_json: er.sources_json as Array<{ url?: string; label?: string; position?: number }>,
      }));

  const mentionSearchRecords = buildMentionSearchRecords({ engineResults: searchEngineRows });

  return {
    business: {
      name: ctx.business.name as string,
      category: ctx.category,
      city: ctx.city,
      state: ctx.state,
      primaryKeyword: ctx.primaryKeyword,
    },
    limits,
    plan: ctx.plan,
    activeCount: activeCountRes.count ?? 0,
    primaryPrompt: prompts.find((p) => p.is_primary && p.status === "active") ?? null,
    activePrompts: prompts.filter((p) => p.status === "active"),
    suggestedPrompts: prompts.filter((p) => p.status === "suggested"),
    prompts: prompts.map((p) => ({
      ...p,
      last_run_at: promptLastRun.get(p.id) ?? null,
      mention_count: promptMentionRuns.get(p.id) ?? 0,
    })),
    runs,
    aggregateMetrics,
    visibilityTrend,
    viewMode,
    selectedRunId: isCombinedView ? "combined" : (selectedRunId ?? displayRun?.id ?? null),
    latestRun: displayRun,
    runningRun,
    engineResults,
    mentionLeaderboard,
    historicalMentions,
    allSources,
    allFanouts,
    recentRunCount: recentRuns.length,
    serpKeyword: (displayRun?.serp_keyword as string) ?? ctx.primaryKeyword,
    mapPack: (displayRun?.map_pack_json as MapPackEntry[]) ?? [],
    organicSerp: (displayRun?.organic_serp_json as OrganicSerpEntry[]) ?? [],
    serpMatches: (displayRun?.serp_match_json as SerpMatchRow[]) ?? [],
    mentionSearchRecords,
  };
}

export async function activatePrompt(params: {
  businessId: string;
  organizationId: string;
  promptId: string;
}) {
  const supabase = createServiceClient();
  const ctx = await loadBusinessContext(params.businessId);
  const limits = getPlanLimits(ctx.plan);

  const { count } = await supabase
    .from("ai_visibility_prompts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId)
    .eq("status", "active");

  if ((count ?? 0) >= limits.activePrompts) {
    throw new Error(
      `Plan limit reached: ${limits.activePrompts} active prompt(s). Archive another prompt or upgrade.`
    );
  }

  const { data: updated, error } = await supabase
    .from("ai_visibility_prompts")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", params.promptId)
    .eq("business_id", params.businessId)
    .eq("organization_id", params.organizationId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Prompt not found or access denied");

  return loadAiVisibilityData(params.businessId);
}

export async function archivePrompt(params: {
  businessId: string;
  promptId: string;
  organizationId?: string;
}) {
  const supabase = createServiceClient();
  let promptQuery = supabase
    .from("ai_visibility_prompts")
    .select("is_primary")
    .eq("id", params.promptId)
    .eq("business_id", params.businessId);
  if (params.organizationId) {
    promptQuery = promptQuery.eq("organization_id", params.organizationId);
  }
  const { data: prompt } = await promptQuery.maybeSingle();

  if (!prompt) throw new Error("Prompt not found or access denied");
  if (prompt.is_primary) {
    throw new Error("Cannot archive the primary prompt. Set another prompt as primary first.");
  }

  let archiveQuery = supabase
    .from("ai_visibility_prompts")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", params.promptId)
    .eq("business_id", params.businessId);
  if (params.organizationId) {
    archiveQuery = archiveQuery.eq("organization_id", params.organizationId);
  }
  const { data: archived, error } = await archiveQuery.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!archived) throw new Error("Prompt not found or access denied");

  return loadAiVisibilityData(params.businessId);
}

export async function runAiVisibilityCheck(params: {
  businessId: string;
  organizationId: string;
  maxPrompts?: number;
  promptIds?: string[];
}): Promise<AiVisibilityRunResult> {
  const supabase = createServiceClient();
  const ctx = await loadBusinessContext(params.businessId);
  const limits = getPlanLimits(ctx.plan);
  const maxPrompts = Math.min(params.maxPrompts ?? 1, limits.activePrompts);
  const businessName = ctx.business.name as string;
  const businessDomain = (ctx.business.website_url as string | null) ?? null;

  let promptQuery = supabase
    .from("ai_visibility_prompts")
    .select("*")
    .eq("business_id", params.businessId)
    .eq("status", "active")
    .order("is_primary", { ascending: false });

  if (params.promptIds?.length) {
    promptQuery = promptQuery.in("id", params.promptIds);
  }

  const { data: prompts } = await promptQuery.limit(maxPrompts);

  if (!prompts?.length) {
    throw new Error("No active prompts. Generate prompts first.");
  }

  const { data: runRow } = await supabase
    .from("ai_visibility_runs")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      status: "running",
      progress_stage: "Checking AI engines",
    })
    .select("id")
    .single();

  const runId = runRow!.id as string;
  const engines = limits.engines;
  const limit = pLimit(4);
  const allEngineResults: EngineResult[] = [];

  try {
    for (const prompt of prompts) {
      const promptEngines = limits.engines;
      const checks = await Promise.all(
        promptEngines.map((engine) =>
          limit(async (): Promise<EngineResult> => {
            const raw = await checkAiEngine({
              engine,
              prompt: prompt.prompt_text,
              organizationId: params.organizationId,
              city: ctx.city,
              state: ctx.state,
            });

            if ("error" in raw) {
              return {
                engine,
                status: "failed",
                targetMentioned: false,
                mentionPosition: null,
                competitors: [],
                brandMentions: [],
                sources: [],
                fanouts: [],
                answerText: null,
                errorMessage: raw.error,
              };
            }

            const extracted = await extractMentionsFromResponse({
              organizationId: params.organizationId,
              promptText: prompt.prompt_text,
              engine,
              responseText: raw.text,
              brandName: businessName,
              domain: businessDomain,
              sources: raw.sources,
            });

            return {
              engine,
              status: "complete",
              targetMentioned: extracted.targetBrandMentioned,
              mentionPosition: extracted.mentionPosition,
              competitors: extracted.competitorNames,
              brandMentions: extracted.brandMentions,
              sources: raw.sources,
              fanouts: raw.fanouts,
              answerText: raw.text.slice(0, 4000),
            };
          })
        )
      );

      allEngineResults.push(...checks);

      const rows = checks.map((c) => ({
        run_id: runId,
        prompt_id: prompt.id,
        organization_id: params.organizationId,
        business_id: params.businessId,
        engine: c.engine,
        status: c.status,
        target_mentioned: c.targetMentioned,
        mention_position: c.mentionPosition,
        competitors_json: c.competitors,
        mentions_json: c.brandMentions,
        sources_json: c.sources,
        fanouts_json: c.fanouts,
        answer_text: c.answerText,
        raw_json: {},
        error_message: c.errorMessage ?? null,
      }));

      if (rows.length) {
        const saveErrors: string[] = [];
        for (const row of rows) {
          const { error: insertErr } = await supabase.from("ai_visibility_engine_results").insert(row);
          if (insertErr) {
            console.error(`[ai-visibility] ${row.engine} result save failed:`, insertErr.message);
            saveErrors.push(`${row.engine}: ${insertErr.message}`);
          }
        }
        if (saveErrors.length === rows.length) {
          throw new Error(`Failed to save AI engine results (${saveErrors.join("; ")})`);
        }
      }
    }

    const completeResults = allEngineResults.filter((r) => r.status === "complete");
    const visibilityScore = computeVisibilityScore({
      engineResults: completeResults.map((r) => ({
        targetMentioned: r.targetMentioned,
        mentionPosition: r.mentionPosition,
        status: r.status,
      })),
    });
    const targetMentioned = completeResults.some((r) => r.targetMentioned);
    const mentionPositions = completeResults
      .map((r) => r.mentionPosition)
      .filter((p): p is number => p != null);
    const mentionPosition = mentionPositions.length ? Math.min(...mentionPositions) : null;
    const competitorSet = new Set(completeResults.flatMap((r) => r.competitors));
    const sourcesCount = completeResults.reduce((s, r) => s + r.sources.length, 0);
    const fanoutsCount = completeResults.reduce((s, r) => s + r.fanouts.length, 0);

    const aiSummary = await generateAiVisibilitySummary({
      organizationId: params.organizationId,
      businessName,
      prompt: prompts[0]!.prompt_text,
      engineResults: completeResults.map((r) => ({
        engine: r.engine,
        targetMentioned: r.targetMentioned,
        mentionPosition: r.mentionPosition,
        competitors: r.competitors,
      })),
    });

    await supabase
      .from("ai_visibility_runs")
      .update({ progress_stage: "Fetching Google map pack & SERP" })
      .eq("id", runId);

    const serpKeyword = ctx.primaryKeyword.trim();
    let mapPackJson: unknown[] = [];
    let organicSerpJson: unknown[] = [];
    let serpMatchJson: SerpMatchRow[] = [];

    const serpSnapshot = serpKeyword
      ? await fetchGoogleSerpSnapshot({
          keyword: serpKeyword,
          location: ctx.searchLocation,
          lat: ctx.lat,
          lng: ctx.lng,
          organizationId: params.organizationId,
        })
      : null;

    if (serpSnapshot) {
      mapPackJson = serpSnapshot.mapPack;
      organicSerpJson = serpSnapshot.organic;

      const taggedMentions = completeResults.flatMap((r) =>
        r.brandMentions.map((m) => ({
          name: m.name,
          normalizedName: m.normalizedName,
          engine: r.engine,
        }))
      );

      const mentionClusters = await deduplicateMentionClusters({
        organizationId: params.organizationId,
        keyword: serpKeyword,
        items: taggedMentions,
      });

      const engineCountByKey = new Map(
        mentionClusters.map((c) => [c.normalizedName, c.engineCount])
      );

      serpMatchJson = await matchAiMentionsToGoogleSerp({
        organizationId: params.organizationId,
        keyword: serpKeyword,
        mentions: completeResults.flatMap((r) => r.brandMentions),
        taggedMentions,
        clusters: mentionClusters,
        engineCounts: engineCountByKey,
        mapPack: serpSnapshot.mapPack,
        organic: serpSnapshot.organic,
      });
    }

    const { error: completeError } = await supabase
      .from("ai_visibility_runs")
      .update({
        status: "complete",
        prompts_checked: prompts.length,
        engines_checked: allEngineResults.length,
        visibility_score: visibilityScore,
        target_mentioned: targetMentioned,
        mention_position: mentionPosition,
        competitor_count: competitorSet.size,
        sources_count: sourcesCount,
        fanouts_count: fanoutsCount,
        ai_summary: aiSummary,
        serp_keyword: serpKeyword || null,
        map_pack_json: mapPackJson,
        organic_serp_json: organicSerpJson,
        serp_match_json: serpMatchJson,
        progress_stage: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (completeError) throw new Error(completeError.message);

    return {
      runId,
      status: "complete",
      visibilityScore,
      targetMentioned,
      mentionPosition,
      competitorCount: competitorSet.size,
      sourcesCount,
      fanoutsCount,
      promptsChecked: prompts.length,
      enginesChecked: allEngineResults.length,
      aiSummary,
      engineResults: allEngineResults,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI visibility check failed";
    await supabase
      .from("ai_visibility_runs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", runId);
    throw err;
  }
}

export async function addManualPrompt(params: {
  businessId: string;
  organizationId: string;
  promptText: string;
  activate?: boolean;
}) {
  const supabase = createServiceClient();
  const ctx = await loadBusinessContext(params.businessId);
  const limits = getPlanLimits(ctx.plan);

  let status: "active" | "suggested" = "suggested";
  if (params.activate) {
    const { count } = await supabase
      .from("ai_visibility_prompts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", params.businessId)
      .eq("status", "active");
    if ((count ?? 0) >= limits.activePrompts) {
      throw new Error(`Plan limit: ${limits.activePrompts} active prompt(s).`);
    }
    status = "active";
  }

  const { error } = await supabase.from("ai_visibility_prompts").insert({
    organization_id: params.organizationId,
    business_id: params.businessId,
    prompt_text: params.promptText.trim(),
    status,
    is_primary: false,
    intent_type: "manual",
    opportunity_score: 3,
    reason: "Manually added prompt",
    engines: DEFAULT_ENGINES,
  });
  if (error) throw new Error(error.message);

  return loadAiVisibilityData(params.businessId);
}

export { buildPrimaryPrompt };
