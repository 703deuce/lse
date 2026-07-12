"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BucketBadge } from "@/components/ui/metric-card";
import type { ActionTask } from "@/lib/audit/types";

export function SopActionPlanRunner({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{
    urgent: ActionTask[];
    sevenDay: ActionTask[];
    thirtyDay: ActionTask[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audits/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, module: "action-plan" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setPlan(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-10 border-t border-border pt-10 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">SOP Action Plan Engine</h2>
          <p className="text-sm text-text-muted">Turns every audit into urgent fixes, 7-day tasks, and 30-day build list</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Running all audits…
            </span>
          ) : (
            "Generate SOP Work Order"
          )}
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {plan && (
        <div className="mt-8 space-y-10">
          <TaskSection title="Top 3 urgent fixes" tasks={plan.urgent} />
          <TaskSection title="Next 7-day tasks" tasks={plan.sevenDay} />
          <TaskSection title="Next 30-day tasks" tasks={plan.thirtyDay} />
        </div>
      )}
    </div>
  );
}

function TaskSection({ title, tasks }: { title: string; tasks: ActionTask[] }) {
  if (!tasks.length) return null;
  return (
    <section>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-4 space-y-4">
        {tasks.map((t) => (
          <div key={t.title} className="rounded-xl border border-border p-5 dark:border-zinc-800">
            <p className="text-xs font-bold uppercase text-primary">{t.module.replace(/-/g, " ")}</p>
            <h4 className="mt-1 font-semibold">{t.title}</h4>
            <p className="mt-2 text-sm text-text-muted">{t.description}</p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Why:</span> {t.why}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <BucketBadge bucket={t.bucket} />
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs dark:bg-zinc-800">Impact: {t.impact}</span>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs dark:bg-zinc-800">Effort: {t.effort}</span>
            </div>
            {t.evidence && <p className="mt-2 text-xs text-text-muted">Evidence: {t.evidence}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
