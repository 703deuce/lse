"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export function ResearchPanel({ businessId }: { businessId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    answer: string;
    sources: Array<{ title?: string; uri?: string }>;
    searchSuggestions?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Research" subtitle="Gemini grounded research with cited sources" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          required
          rows={3}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="e.g. What are current GBP guidelines for service-area businesses?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Research
        </button>
      </form>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="font-semibold">Answer</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{result.answer}</p>
          </div>
          {result.sources?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-500">Sources</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {result.sources.map((s, i) => (
                  <li key={i}>
                    {s.uri ? (
                      <a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                        {s.title ?? s.uri}
                      </a>
                    ) : (
                      s.title
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
