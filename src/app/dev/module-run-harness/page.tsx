"use client";

import { Suspense, useLayoutEffect, useState } from "react";
import { AiVisibilityDashboard } from "@/components/ai-visibility/ai-visibility-dashboard";
import { CitationAuditDashboard } from "@/components/citations/citation-audit-dashboard";
import { MapsDifficultyTool } from "@/components/maps-difficulty/maps-difficulty-tool";
import { ReputationAuditDashboard } from "@/components/reputation/reputation-audit-dashboard";

const BID = "preview";

let fetchPatched = false;

function patchHarnessFetch() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "POST" && url.includes("/api/maps-difficulty/geocode")) {
      return new Response(
        JSON.stringify({ lat: 38.6582, lng: -77.2497, label: "Woodbridge, VA" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      method === "POST" &&
      /\/api\/(citations|reputation|ai-visibility|maps-difficulty|audits)\/run/.test(url)
    ) {
      return new Response(JSON.stringify({ queued: true, jobId: "harness-job", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes(`/api/citations/${BID}`)) {
      return new Response(
        JSON.stringify({
          audit: null,
          listings: [],
          missing: [],
          competitorPresence: [],
          tasks: [],
          napIssues: [],
          hasCompetitors: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes(`/api/reputation/${BID}`)) {
      return new Response(
        JSON.stringify({
          audit: null,
          targetReviews: [],
          competitors: [],
          keywordGaps: [],
          tasks: [],
          drafts: [],
          hasCompetitors: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes(`/api/ai-visibility/${BID}`)) {
      return new Response(
        JSON.stringify({
          latestRun: null,
          runningRun: null,
          runs: [],
          aggregateMetrics: null,
          mentionLeaderboard: [],
          historicalMentions: [],
          visibilityTrend: [],
          allSources: [],
          primaryPrompt: {
            id: "prompt-1",
            prompt_text: "best plumber near me",
            is_primary: true,
          },
          business: {
            name: "Preview Plumbing",
            category: "plumber",
            city: "Woodbridge",
            state: "VA",
            primaryKeyword: "plumber",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/jobs/") && url.includes("/status")) {
      return new Response(
        JSON.stringify({
          jobId: "harness-job",
          status: "completed",
          phase: "completed",
          version: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/maps-difficulty")) {
      return new Response(JSON.stringify({ ok: true, history: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

export default function ModuleRunHarnessPage() {
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<"citations" | "reputation" | "ai" | "maps">("citations");

  useLayoutEffect(() => {
    patchHarnessFetch();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="space-y-4 px-5 py-6 lg:px-8">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["citations", "Citations"],
            ["reputation", "Reputation"],
            ["ai", "AI Visibility"],
            ["maps", "Maps Difficulty"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              section === id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "citations" && <CitationAuditDashboard businessId={BID} />}
      {section === "reputation" && (
        <Suspense fallback={<div className="py-8 text-sm text-zinc-500">Loading…</div>}>
          <ReputationAuditDashboard businessId={BID} />
        </Suspense>
      )}
      {section === "ai" && <AiVisibilityDashboard businessId={BID} />}
      {section === "maps" && <MapsDifficultyTool />}
    </div>
  );
}
