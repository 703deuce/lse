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

function isRateLimitError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("concurrency")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry Cloro engines with exponential backoff + jitter on concurrency/rate limits. */
async function withCloroRetry(
  fn: () => Promise<{ ok: true; result: CloroMonitorResult } | { ok: false; error: string }>
): Promise<{ ok: true; result: CloroMonitorResult } | { ok: false; error: string }> {
  const maxAttempts = 3;
  let last: { ok: false; error: string } | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const outcome = await cloroLimit(fn);
    if (outcome.ok) return outcome;
    last = outcome;
    if (!isRateLimitError(outcome.error) || attempt === maxAttempts - 1) {
      return outcome;
    }
    const base = 800 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 400);
    await sleep(base + jitter);
  }
  return last ?? { ok: false, error: "Cloro request failed" };
}

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
      const cloro = await withCloroRetry(() =>
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
      return {
        error: claude.error.startsWith("Claude")
          ? claude.error
          : `Claude provider failed: ${claude.error}`,
      };
    }

    default:
      return { error: `Unsupported engine: ${params.engine}` };
  }
}
