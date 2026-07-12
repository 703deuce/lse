"use client";

import { BucketBadge } from "@/components/ui/metric-card";

export interface ComparisonProfile {
  name: string;
  isTarget?: boolean;
  category?: string | null;
  additional_categories?: string[];
  rating?: number | null;
  review_count?: number | null;
  photo_count?: number | null;
  post_count?: number | null;
  is_claimed?: boolean | null;
  description?: string | null;
  recent_review_count?: number | null;
}

export function CompetitorComparison({ profiles }: { profiles: ComparisonProfile[] }) {
  if (!profiles.length) return null;

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-border dark:border-zinc-800">
            <th className="pb-3 pr-4 font-medium">Business</th>
            <th className="pb-3 pr-4 font-medium">Category</th>
            <th className="pb-3 pr-4 font-medium">Rating</th>
            <th className="pb-3 pr-4 font-medium">Reviews</th>
            <th className="pb-3 pr-4 font-medium">Photos</th>
            <th className="pb-3 pr-4 font-medium">Posts</th>
            <th className="pb-3 pr-4 font-medium">Recent reviews</th>
            <th className="pb-3 font-medium">Claimed</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr
              key={p.name}
              className={`border-b border-border dark:border-zinc-900 ${p.isTarget ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
            >
              <td className="py-3 pr-4 font-medium">
                {p.name}
                {p.isTarget && (
                  <span className="ml-2 text-xs text-primary">You</span>
                )}
              </td>
              <td className="py-3 pr-4">{p.category ?? "—"}</td>
              <td className="py-3 pr-4">{p.rating ?? "—"}</td>
              <td className="py-3 pr-4">{p.review_count ?? "—"}</td>
              <td className="py-3 pr-4">{p.photo_count ?? "—"}</td>
              <td className="py-3 pr-4">{p.post_count ?? "—"}</td>
              <td className="py-3 pr-4">{p.recent_review_count ?? "—"}</td>
              <td className="py-3">{p.is_claimed === false ? "No" : p.is_claimed ? "Yes" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-text-muted">
        Side-by-side public profile signals used for the deterministic audit engine.
      </p>
    </div>
  );
}

export function FindingEvidence({
  evidence,
}: {
  evidence: Record<string, unknown> | null | undefined;
}) {
  if (!evidence || !Object.keys(evidence).length) return null;
  return (
    <details className="mt-3 rounded-lg border border-border bg-surface-subtle p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer font-medium">Evidence</summary>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-text-muted dark:text-text-muted">
        {JSON.stringify(evidence, null, 2)}
      </pre>
    </details>
  );
}

export { BucketBadge };
