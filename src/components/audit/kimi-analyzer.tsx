"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

export function KimiScreenshotAnalyzer({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          prompt:
            "Extract visible Google Business Profile details from this screenshot: business name, categories, rating, review count, and any visible issues.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.analysis);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-border p-5 dark:border-zinc-800">
      <h2 className="font-semibold">Screenshot analysis (Kimi)</h2>
      <p className="mt-1 text-sm text-text-muted">
        Upload a GBP screenshot for multimodal analysis
      </p>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-subtle dark:border-zinc-700 dark:hover:bg-zinc-900">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Upload screenshot
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>
      {result && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-surface-subtle p-4 text-sm dark:bg-zinc-900">{result}</pre>
      )}
    </section>
  );
}
