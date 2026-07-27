"use client";

import { useState } from "react";
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

export function ReviewReplyGenerator({ embed = false }: { embed?: boolean }) {
  const [businessName, setBusinessName] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("friendly");
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
    <FreeToolShell
      embed={embed}
      title="AI Review Reply Generator"
      subtitle="Paste a customer review, choose a tone, and generate a professional Google review reply."
      steps={[
        { label: "Paste the review" },
        { label: "Choose a tone" },
        { label: "AI generates a reply" },
        { label: "Review and copy" },
      ]}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <FreeToolField label="Business name">
            <input
              className={freeToolInputClass}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your business name"
            />
          </FreeToolField>

          <FreeToolField label="Select a review (paste text)">
            <textarea
              className={cn(freeToolInputClass, "min-h-[140px] h-auto py-2.5")}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Paste the customer’s Google review here…"
            />
          </FreeToolField>

          <div>
            <p className="mb-1.5 text-[12px] font-bold text-[#344054]">Choose a tone</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[12px] font-bold",
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
            className={cn(freeToolPrimaryBtnClass, "w-full sm:w-auto")}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate AI Reply
          </button>
          {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}
        </div>

        <div className="rounded-2xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-[#137752]">
            Preview
          </p>
          <div className="mb-3 rounded-xl border border-[#E6EAF0] bg-white p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#0B1220]">Customer review</p>
              <span className="text-[#FDB022]">★★★★★</span>
            </div>
            <p className="text-sm leading-relaxed text-[#667085]">
              {reviewText.trim() || "Paste a review on the left to preview it here."}
            </p>
          </div>
          <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF5] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#027A48]">
                AI reply
              </p>
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
            <p className="min-h-[88px] whitespace-pre-wrap text-sm leading-relaxed text-[#144C34]">
              {reply || "Your generated reply will appear here."}
            </p>
          </div>
        </div>
      </div>
    </FreeToolShell>
  );
}
