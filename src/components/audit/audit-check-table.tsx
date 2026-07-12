import type { AuditCheck } from "@/lib/audit/types";
import { MatchStatusBadge } from "@/components/audit/match-status-badge";
import { BucketBadge } from "@/components/ui/metric-card";

export function AuditCheckTable({ checks }: { checks: AuditCheck[] }) {
  if (!checks.length) {
    return <p className="text-sm text-text-muted">No checks available. Add a website URL and re-run.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle text-left text-xs uppercase text-text-muted dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-3">Check</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">GBP</th>
            <th className="px-4 py-3">Website</th>
            <th className="px-4 py-3">Bucket</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {checks.map((c) => (
            <tr key={c.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium">{c.label}</p>
                {c.whyItMatters && <p className="mt-1 text-xs text-text-muted">{c.whyItMatters}</p>}
              </td>
              <td className="px-4 py-3">
                <MatchStatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 text-text-muted dark:text-text-muted">{c.gbpValue ?? "—"}</td>
              <td className="px-4 py-3 text-text-muted dark:text-text-muted">{c.websiteValue ?? "—"}</td>
              <td className="px-4 py-3">
                <BucketBadge bucket={c.bucket} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
