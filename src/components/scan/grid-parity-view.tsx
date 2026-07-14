"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PARITY_TEST_PROFILES } from "@/lib/maps/scan-profiles";

export function GridParityView({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(false);
  const [scans, setScans] = useState<
    Array<{ profile: string; profileId: string; scanId: string }> | null
  >(null);

  async function runParityBatch() {
    setLoading(true);
    try {
      const res = await fetch("/api/scans/parity-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScans(data.scans);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Parity batch failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Local Falcon parity test"
        subtitle="Runs the same 5×5 grid four times with different DataForSEO device profiles. Compare each result against your Local Falcon export."
      />

      <ul className="space-y-2 text-sm">
        {PARITY_TEST_PROFILES.map((p) => (
          <li key={p.id} className="rounded-lg border border-zinc-200/80 bg-white px-3.5 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <strong>{p.label}</strong> — {p.device} / {p.os} / {p.browser}
            {p.description ? <span className="ml-2 text-zinc-500">({p.description})</span> : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={runParityBatch}
        disabled={loading}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run parity batch
      </button>

      {scans && (
        <ul className="mt-6 space-y-2">
          {scans.map((s) => (
            <li key={s.scanId}>
              <Link href={`/businesses/${businessId}/grid/${s.scanId}`} className="text-emerald-600 hover:underline">
                {s.profile} → open grid
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
