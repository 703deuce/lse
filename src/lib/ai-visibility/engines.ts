import pLimit from "p-limit";
import type { AiEngine } from "@/lib/ai-visibility/types";
import {
  cloroMonitorDetailed,
  isCloroConfigured,
  type CloroMonitorResult,
} from "@/lib/providers/cloro";
import { groundedResearch } from "@/lib/providers/gemini";
import { claudeWebSearchDetailed } from "@/lib/providers/anthropic";
import {
  fetchGoogleAiOverviewDetailed,
  isScrapingDogGoogleAiConfigured,
} from "@/lib/providers/scrapingdog/google-ai-overview";

/** Cloro sync monitors share plan concurrency — run one at a time across ChatGPT/Perplexity. */
const cloroLimit = pLimit(1);

export type EngineCheckResult = CloroMonitorResult | { error: string };

function cloroResult(result: CloroMonitorResult): EngineCheckResult {
  return result;
}

function directResult(params: {
  text: string;
  sources: Array<{ url?: string; label?: string; position?: number }>;
  fanouts?: string[];
}): EngineCheckResult {
  return {
    text: params.text,
    sources: params.sources,
    fanouts: params.fanouts ?? [],
    mapNames: [],
    raw: {},
  };
}

export async function checkAiEngine(params: {
  engine: AiEngine;
  prompt: string;
  organizationId?: string;
  city?: string;
  state?: string;
}): Promise<EngineCheckResult> {
  switch (params.engine) {
    case "chatgpt":
    case "perplexity": {
      if (!isCloroConfigured()) {
        return {
          error: "CLORO_API_KEY not configured — add to .env.local / Coolify and restart",
        };
      }
      const cloro = await cloroLimit(() =>
        cloroMonitorDetailed({
          engine: params.engine,
          prompt: params.prompt,
          organizationId: params.organizationId,
        })
      );
      if (cloro.ok) return cloroResult(cloro.result);
      return { error: cloro.error };
    }

    case "gemini": {
      const gemini = await groundedResearch({
        question: params.prompt,
        organizationId: params.organizationId,
      });
      if (gemini?.answer) {
        return directResult({
          text: gemini.answer,
          sources: gemini.sources.map((s, i) => ({
            url: s.uri,
            label: s.title,
            position: i + 1,
          })),
          fanouts: gemini.searchSuggestions ?? [],
        });
      }
      return {
        error:
          process.env.GOOGLE_GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()
            ? "Gemini check failed (direct API)"
            : "Gemini requires GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY",
      };
    }

    case "google_ai_overview": {
      // Google AI Overview stays on ScrapingDog (not Cloro).
      if (!isScrapingDogGoogleAiConfigured()) {
        return {
          error: "SCRAPINGDOG_API_KEY not configured — required for Google AI Overview",
        };
      }
      const aio = await fetchGoogleAiOverviewDetailed({
        query: params.prompt,
        organizationId: params.organizationId,
      });
      if (!aio.ok) {
        return { error: aio.error };
      }
      if (!aio.result.hasAiOverview) {
        return directResult({
          text: "No AI Overview appeared for this query.",
          sources: [],
          fanouts: [],
        });
      }
      return directResult({
        text: aio.result.text,
        sources: aio.result.sources,
        fanouts: aio.result.fanouts,
      });
    }

    case "claude": {
      // Claude stays on Anthropic Messages + web_search tool.
      const claude = await claudeWebSearchDetailed({
        prompt: params.prompt,
        city: params.city,
        state: params.state,
        organizationId: params.organizationId,
      });
      if (claude.ok) {
        return directResult({
          text: claude.result.answer,
          sources: claude.result.sources,
          fanouts: claude.result.fanouts,
        });
      }
      return { error: claude.error };
    }

    default:
      return { error: `Unsupported engine: ${params.engine}` };
  }
}
