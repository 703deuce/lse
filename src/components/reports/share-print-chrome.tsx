"use client";

import { Printer } from "lucide-react";

/**
 * Print / Save as PDF control outside the sandboxed share iframe.
 * Opens the report HTML in a new window and triggers the browser print dialog.
 */
export function SharePrintChrome({ html }: { html: string }) {
  function handlePrint() {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Allow styles/images to settle before print.
    w.setTimeout(() => {
      w.focus();
      w.print();
    }, 250);
  }

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur print:hidden">
      <p className="text-[12px] text-zinc-600">Client report</p>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-[12px] font-medium text-white hover:bg-zinc-800"
      >
        <Printer className="h-3.5 w-3.5" />
        Print / Save as PDF
      </button>
    </div>
  );
}
