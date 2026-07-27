"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "grateful", label: "Grateful" },
  { id: "concise", label: "Concise" },
] as const;

export function ReviewReplyGenerator({ embed = false }: { embed?: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("professional");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setReply("");
    try {
      const res = await fetch("/api/public/review-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, reviewText, tone }),
      });
      const json = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) {
        throw new Error(json.error || "Could not generate a reply");
      }
      setReply(json.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a reply");
    } finally {
      setLoading(false);
    }
  }

  async function copyReply() {
    if (!reply) return;
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn(embed ? "min-h-screen bg-[#F7FAF8] p-4" : "mx-auto max-w-2xl px-4 py-10")}>
      {!embed ? (
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#027A48]">
            Free tool
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1220]">
            AI Review Reply Generator
          </h1>
          <p className="mt-2 text-[15px] text-[#667085]">
            Paste a customer review, choose a tone, and copy a professional reply.
          </p>
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[#344054]">Business name</span>
          <input
            className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#137752]"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Plumbing"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-[#344054]">Customer review</span>
          <textarea
            className="min-h-[140px] w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#137752]"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Paste the Google review here…"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-[#344054]">Tone</span>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold",
                  tone === t.id
                    ? "border-[#137752] bg-[#ECFDF3] text-[#027A48]"
                    : "border-[#D0D5DD] bg-white text-[#344054]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={loading || reviewText.trim().length < 8}
          onClick={() => void generate()}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#137752] text-sm font-semibold text-white hover:bg-[#0f6344] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate reply
        </button>

        {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

        {reply ? (
          <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#027A48]">
                Suggested reply
              </p>
              <button
                type="button"
                onClick={() => void copyReply()}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#027A48]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#144C34]">{reply}</p>
          </div>
        ) : null}
      </div>

      {!embed ? (
        <p className="mt-6 text-center text-[13px] text-[#667085]">
          Want automatic review requests and ranking scans?{" "}
          <Link href="/sign-up" className="font-semibold text-[#137752] hover:underline">
            Start free
          </Link>
        </p>
      ) : null}
    </div>
  );
}
