"use client";

import { useState } from "react";
import type { ActionItem } from "@/lib/db/types";
import { RunScanButton } from "@/components/scan/run-scan-button";

export function TaskList({
  items,
  businessId,
}: {
  items: ActionItem[];
  businessId: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.status]))
  );

  async function toggle(id: string) {
    const current = statuses[id] ?? "open";
    const next = current === "done" ? "open" : "done";
    setStatuses((s) => ({ ...s, [id]: next }));
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: id, status: next }),
      });
      if (!res.ok) {
        setStatuses((s) => ({ ...s, [id]: current }));
      }
    } catch {
      setStatuses((s) => ({ ...s, [id]: current }));
    }
  }

  if (!items.length) return null;

  return (
    <div className="mt-10 border-t border-border pt-8 dark:border-zinc-800">
      <h2 className="font-semibold">Track completion</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={statuses[item.id] === "done"}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 rounded border-border"
            />
            <span className={statuses[item.id] === "done" ? "line-through text-text-muted" : ""}>
              {item.title}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <p className="mb-2 text-sm text-text-muted">After completing actions, re-run a scan:</p>
        <RunScanButton businessId={businessId} />
      </div>
    </div>
  );
}
