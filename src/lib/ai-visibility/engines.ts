import type { AiEngine } from "@/lib/ai-visibility/types";
import {
  cloroMonitorDetailed,
  isCloroConfigured,
  type CloroMonitorResult,
} from "@/lib/providers/cloro";
import { groundedResearch } from "@/lib/providers/gemini";
import { claudeWebSearch } from "@/lib/providers/anthropic";
import {
  fetchGoogleAiOverview,
  isScrapingDogGoogleAiConfigured,
} from "@/lib/providers/scrapingdog/google-ai-overview";

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
          error: "CLORO_API_KEY not configured — add to .env.local and restart dev server",
        };
      }
      const cloro = await cloroMonitorDetailed({
        engine: params.engine,
        prompt: params.prompt,
        organizationId: params.organizationId,
      });
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
      if (!isScrapingDogGoogleAiConfigured()) {
        return {
          error: "SCRAPINGDOG_API_KEY not configured — required for Google AI Overview",
        };
      }
      const aio = await fetchGoogleAiOverview({
        query: params.prompt,
        organizationId: params.organizationId,
      });
      if (!aio) {
        return { error: "Google AI Overview check failed (ScrapingDog)" };
      }
      if (!aio.hasAiOverview) {
        return directResult({
          text: "No AI Overview appeared for this query.",
          sources: [],
          fanouts: [],
        });
      }
      return directResult({
        text: aio.text,
        sources: aio.sources,
        fanouts: aio.fanouts,
      });
    }

    case "claude": {
      const claude = await claudeWebSearch({
        prompt: params.prompt,
        city: params.city,
        state: params.state,
        organizationId: params.organizationId,
      });
      if (claude?.answer) {
        return directResult({
          text: claude.answer,
          sources: claude.sources,
          fanouts: claude.fanouts,
        });
      }
      return {
        error: process.env.ANTHROPIC_API_KEY?.trim()
          ? "Claude check failed (Anthropic web search)"
          : "Claude requires ANTHROPIC_API_KEY — add to .env.local and restart dev server",
      };
    }

    default:
      return { error: `Unsupported engine: ${params.engine}` };
  }
}
