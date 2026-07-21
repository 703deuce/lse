"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/** Renders AI model answer text as readable markdown (not raw pre-wrap). */
export function AiMarkdownResponse({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const text = content.trim();
  if (!text) {
    return <p className="text-[13px] text-zinc-500">No answer text returned.</p>;
  }

  return (
    <div
      className={cn(
        "ai-md max-h-[28rem] overflow-y-auto rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 text-[13px] leading-relaxed text-zinc-700",
        "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:text-zinc-900",
        "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:text-zinc-900",
        "[&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-zinc-900",
        "[&_p]:mb-2.5 [&_p]:last:mb-0",
        "[&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_li]:text-[13px] [&_li]:leading-snug",
        "[&_strong]:font-semibold [&_strong]:text-zinc-900",
        "[&_em]:italic",
        "[&_a]:font-medium [&_a]:text-emerald-700 [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-zinc-800",
        "[&_pre]:mb-2.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:text-zinc-100",
        "[&_blockquote]:mb-2.5 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-200 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-600",
        "[&_hr]:my-3 [&_hr]:border-zinc-200",
        className
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
