"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FreeToolField,
  FreeToolShell,
  freeToolInputClass,
  freeToolPrimaryBtnClass,
} from "@/components/tools/free-tool-shell";

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "grateful", label: "Empathetic" },
  { id: "concise", label: "Concise" },
] as const;

const SAMPLE_REVIEWS = [
  {
    id: "jeremy",
    author: "Jeremy C.",
    rating: 5,
    text: "Outstanding service from start to finish. They explained everything clearly and finished the job faster than expected. Highly recommend!",
  },
  {
    id: "maria",
    author: "Maria L.",
    rating: 4,
    text: "Great experience overall. Friendly staff and fair pricing. Would come back again.",
  },
  {
    id: "custom",
    author: "Custom review",
    rating: 5,
    text: "",
  },
] as const;

export function ReviewReplyGenerator({ embed = false }: { embed?: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [selectedId, setSelectedId] = useState<(typeof SAMPLE_REVIEWS)[number]["id"]>("jeremy");
  const [customText, setCustomText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("friendly");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const active = useMemo(
    () => SAMPLE_REVIEWS.find((r) => r.id === selectedId) ?? SAMPLE_REVIEWS[0],
    [selectedId]
  );

  const reviewText = selectedId === "custom" ? customText : active.text;

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
    <FreeToolShell
      embed={embed}
      title="AI Review Reply Generator"
      subtitle="Select a review, choose a tone, and generate a professional Google reply."
      steps={[
        { label: "Connect GMB account" },
        { label: "Select a Review" },
        { label: "AI Generates a Reply" },
        { label: "Review and Post" },
      ]}
      ctaLabel="Get started"
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <FreeToolField label="Business name">
            <input
              className={freeToolInputClass}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your business name"
            />
          </FreeToolField>

          <FreeToolField label="Select a Review">
            <select
              className={freeToolInputClass}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value as typeof selectedId)}
            >
              {SAMPLE_REVIEWS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id === "custom" ? "Paste your own review…" : `${r.author} · ${r.rating} stars`}
                </option>
              ))}
            </select>
          </FreeToolField>

          {selectedId === "custom" ? (
            <FreeToolField label="Paste review text">
              <textarea
                className={cn(freeToolInputClass, "min-h-[120px] h-auto py-2.5")}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste the customer’s Google review here…"
              />
            </FreeToolField>
          ) : null}

          <div>
            <p className="mb-1.5 text-[12px] font-bold text-[#344054]">Choose a Tone</p>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2.5 text-[13px] font-bold",
                    tone === t.id
                      ? "border-[#137752] bg-[#ECFDF5] text-[#137752]"
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
            className={cn(freeToolPrimaryBtnClass, "w-full")}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate AI Reply
          </button>
          {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
        </div>

        <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
          <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#0B1220]">
                {selectedId === "custom" ? "Your customer" : active.author}
              </p>
              <span className="text-[#FDB022]">{"★".repeat(active.rating)}</span>
            </div>
            <p className="text-sm leading-relaxed text-[#667085]">
              {reviewText.trim() || "Choose a sample review or paste your own."}
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF5] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#027A48]">AI reply</p>
              {reply ? (
                <button
                  type="button"
                  onClick={() => void copyReply()}
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-[#027A48]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
            <p className="min-h-[100px] whitespace-pre-wrap text-sm leading-relaxed text-[#144C34]">
              {reply || "Your generated reply will appear here."}
            </p>
          </div>
        </div>
      </div>
    </FreeToolShell>
  );
}
