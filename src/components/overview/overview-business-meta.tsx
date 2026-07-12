"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAddress(address: string) {
  return address.replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim();
}

export function OverviewBusinessMeta({
  address,
  primaryCategory,
  businessId,
}: {
  address: string | null;
  primaryCategory: string | null;
  businessId: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(businessId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <p className="mt-1 text-sm text-text-muted">
        {address ? formatAddress(address) : "—"}
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-text-muted">
        <span>
          Primary Category: {primaryCategory ? titleCase(primaryCategory) : "—"} · Business ID:
          (hidden)
        </span>
        <button
          type="button"
          onClick={() => void copyId()}
          className="inline-flex items-center text-text-muted hover:text-text-muted"
          aria-label="Copy business ID"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </p>
    </>
  );
}
