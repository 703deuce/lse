"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { scoreToStars } from "@/lib/ai-visibility/limits";
import { ENGINE_LABELS, type AiEngine } from "@/lib/ai-visibility/types";
import { cn } from "@/lib/utils";
import type { PromptRow, VisibilityData } from "@/components/ai-visibility/ai-visibility-types";
import { ModulePage } from "@/components/ui/design-system";

const GROUP_COLORS: Record<string, string> = {
  "Core Visibility": "bg-emerald-100 text-emerald-800",
  "Pricing & Services": "bg-violet-100 text-violet-800",
  "Service Quality": "bg-blue-100 text-blue-800",
  Sustainability: "bg-teal-100 text-teal-800",
  Industry: "bg-amber-100 text-amber-800",
  "Trust & Authority": "bg-orange-100 text-orange-800",
};

const ALL_ENGINES: AiEngine[] = ["chatgpt", "perplexity", "gemini", "google_ai_overview", "claude"];

function groupColor(category: string | null) {
  if (!category) return "bg-surface-subtle text-text";
  return GROUP_COLORS[category] ?? "bg-surface-subtle text-text";
}

function promptTitle(text: string) {
  const first = text.split(/[.!?]/)[0]?.trim() ?? text;
  return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

function promptDescription(text: string) {
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

export function AiVisibilityPromptsPage({ businessId }: { businessId: string }) {
  const [data, setData] = useState<VisibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PromptRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-visibility/${businessId}?runId=combined`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function activatePrompt(promptId: string) {
    setBusy(promptId);
    try {
      const res = await fetch("/api/ai-visibility/prompts/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, promptId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Activate failed");
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activate failed");
    } finally {
      setBusy(null);
    }
  }

  async function addPrompt(activate: boolean) {
    if (!draft.trim()) return;
    setBusy("add");
    try {
      const res = await fetch("/api/ai-visibility/prompts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, promptText: draft, activate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Add failed");
      await load();
      setDraft("");
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(null);
    }
  }

  const prompts = (data?.prompts ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && !p.prompt_text.toLowerCase().includes(q)) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(prompts.length / pageSize));
  const paged = prompts.slice((page - 1) * pageSize, page * pageSize);

  const activeCount = data?.activeCount ?? 0;
  const suggestedCount = (data?.prompts ?? []).filter((p) => p.status === "suggested").length;
  const archivedCount = (data?.prompts ?? []).filter((p) => p.status === "archived").length;

  const city = data?.business.city;
  const state = data?.business.state;

  if (loading && !data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ModulePage>
      <div className="flex items-center gap-1 text-xs text-text-muted">
        <Link href={`/businesses/${businessId}/ai-visibility`} className="hover:text-emerald-700">
          AI Visibility
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text">Manage Prompts</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">Manage Prompts</h1>
          <p className="mt-1 text-[13px] leading-snug text-text-muted">
            Create, organize, and manage AI prompts used to track visibility and surface insights across AI platforms.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#16A34A] px-3 text-[13px] font-semibold text-white hover:bg-[#15803D]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Prompt
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] text-red-800">{error}</div>}

      <div className="flex flex-wrap gap-4 border-b border-border pb-1 text-[13px]">
        {[
          { id: "all", label: "All Prompts" },
          { id: "active", label: `Active (${activeCount})` },
          { id: "suggested", label: `Drafts (${suggestedCount})` },
          { id: "archived", label: `Archived (${archivedCount})` },
          { id: "groups", label: "Prompt Groups" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => t.id !== "groups" && setStatusFilter(t.id)}
            className={cn(
              "border-b-2 pb-2 font-medium",
              statusFilter === t.id ? "border-primary text-emerald-700" : "border-transparent text-text-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts by name or keyword…"
          className="min-w-[220px] flex-1 rounded-md border border-border bg-white px-3.5 py-2 text-[13px] shadow-sm"
        />
        <select className="rounded-md border border-border bg-white px-2.5 py-2 text-xs font-medium text-text shadow-sm" defaultValue="all">
          <option value="all">All Groups</option>
          <option value="core">Core Visibility</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-white px-2.5 py-2 text-xs font-medium text-text shadow-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suggested">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select className="rounded-md border border-border bg-white px-2.5 py-2 text-xs font-medium text-text shadow-sm" defaultValue="all">
          <option value="all">All Engines</option>
          {ALL_ENGINES.map((e) => (
            <option key={e} value={e}>
              {ENGINE_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-border bg-white shadow-sm overflow-hidden">
          <table className="min-w-full text-[13px]">
            <thead className="border-b border-border bg-surface-subtle/80">
              <tr>
                <th className="px-3.5 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Prompt</th>
                <th className="px-3.5 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Group</th>
                <th className="px-3.5 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Status</th>
                <th className="px-3.5 py-2 text-center text-[10px] font-semibold uppercase text-text-muted">Active</th>
                <th className="px-3.5 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Last Run</th>
                <th className="px-3.5 py-2 text-left text-[10px] font-semibold uppercase text-text-muted">Schedule</th>
                <th className="px-3.5 py-2 text-center text-[10px] font-semibold uppercase text-text-muted">Runs</th>
                <th className="w-10 px-3.5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paged.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={cn(
                    "cursor-pointer hover:bg-surface-subtle/80",
                    selected?.id === p.id && "bg-emerald-50/50 ring-1 ring-inset ring-emerald-200"
                  )}
                >
                  <td className="max-w-xs px-3.5 py-2">
                    <p className="font-medium text-text">{promptTitle(p.prompt_text)}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{promptDescription(p.prompt_text)}</p>
                  </td>
                  <td className="px-3.5 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", groupColor(p.category))}>
                      {p.category ?? "Core Visibility"}
                    </span>
                  </td>
                  <td className="px-3.5 py-2">
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        p.status === "active" ? "text-emerald-700" : "text-text-muted"
                      )}
                    >
                      {p.status === "suggested" ? "Draft" : p.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-center">
                    {p.status === "active" ? (
                      <Check className="mx-auto h-4 w-4 text-primary" />
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 text-xs text-text-muted">
                    {p.last_run_at
                      ? new Date(p.last_run_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </td>
                  <td className="px-3.5 py-2 text-xs text-text-muted">Daily 8:00 AM</td>
                  <td className="px-3.5 py-2 text-center tabular-nums text-text">{p.mention_count ?? 128}</td>
                  <td className="px-3.5 py-2">
                    <button type="button" className="rounded p-1 text-text-muted hover:bg-surface-subtle">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-2 text-xs text-text-muted">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, prompts.length)} of {prompts.length} prompts
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded border text-xs",
                    p === page ? "border-primary text-emerald-700" : "border-transparent hover:bg-surface-subtle"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {selected ? (
          <div className="rounded-lg border border-border bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text">Edit Prompt</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-emerald-800">
                  {selected.status === "suggested" ? "Draft" : selected.status}
                </span>
              </div>
              <div className="flex gap-1">
                <button type="button" className="rounded p-1 text-text-muted hover:bg-surface-subtle">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-text-muted hover:bg-surface-subtle">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(100vh-12rem)] space-y-3 overflow-y-auto p-3.5">
              <label className="block text-[13px]">
                <span className="mb-1 flex justify-between text-xs font-medium text-text-muted">
                  Prompt Name
                  <span className="text-text-muted">{promptTitle(selected.prompt_text).length}/80</span>
                </span>
                <input
                  readOnly
                  value={promptTitle(selected.prompt_text)}
                  className="w-full rounded-md border border-border bg-white px-3.5 py-2 text-[13px]"
                />
              </label>
              <label className="block text-[13px]">
                <span className="mb-1 block text-xs font-medium text-text-muted">Prompt Group</span>
                <select className="w-full rounded-md border border-border bg-white px-3.5 py-2 text-[13px]" defaultValue={selected.category ?? "Core Visibility"}>
                  <option>Core Visibility</option>
                  <option>Pricing & Services</option>
                  <option>Service Quality</option>
                  <option>Trust & Authority</option>
                </select>
              </label>
              <label className="block text-[13px]">
                <span className="mb-1 flex justify-between text-xs font-medium text-text-muted">
                  Prompt Text
                  <span className="text-text-muted">{selected.prompt_text.length}/2000</span>
                </span>
                <textarea
                  readOnly
                  value={selected.prompt_text}
                  rows={5}
                  className="w-full rounded-md border border-border bg-surface-subtle px-3.5 py-2 text-[13px]"
                />
                <button type="button" className="mt-1 text-[10px] font-medium text-emerald-700">
                  Insert Variable {"{}"}
                </button>
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-text-muted">Location Context</span>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-subtle px-3.5 py-2 text-[13px]">
                  <span>{city && state ? `${city}, ${state}` : "Business location"}</span>
                  <span className="rounded bg-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">25 mi radius</span>
                </div>
                <button type="button" className="mt-1 text-[10px] font-medium text-emerald-700">
                  + Add another location
                </button>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-text-muted">Run Frequency</span>
                <div className="flex flex-wrap gap-2">
                  <select className="rounded-md border border-border px-2 py-2 text-[13px]" defaultValue="daily">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <select className="rounded-md border border-border px-2 py-2 text-[13px]" defaultValue="8">
                    <option value="8">8:00 AM</option>
                    <option value="12">12:00 PM</option>
                  </select>
                  <span className="self-center text-xs text-text-muted">EST</span>
                </div>
              </div>
              <div>
                <span className="mb-2 block text-xs font-medium text-text-muted">Engines to Include</span>
                <div className="flex flex-wrap gap-2">
                  {ALL_ENGINES.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"
                    >
                      <Check className="h-3 w-3" />
                      {ENGINE_LABELS[e]}
                    </span>
                  ))}
                  <button type="button" className="rounded-full border border-dashed border-border px-2.5 py-1 text-[10px] font-medium text-text-muted">
                    + Add Engine
                  </button>
                </div>
              </div>
              <label className="block text-[13px]">
                <span className="mb-1 flex justify-between text-xs font-medium text-text-muted">
                  Notes (Optional)
                  <span className="text-text-muted">{(selected.reason ?? "").length}/500</span>
                </span>
                <textarea
                  readOnly
                  value={selected.reason ?? ""}
                  rows={3}
                  placeholder="Internal notes about this prompt…"
                  className="w-full rounded-md border border-border bg-surface-subtle px-3.5 py-2 text-[13px]"
                />
              </label>
              {selected.opportunity_score != null && (
                <p className="text-xs text-text-muted">Opportunity: {scoreToStars(selected.opportunity_score)}</p>
              )}
            </div>
            <div className="flex gap-2 border-t border-border p-3.5">
              <button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-md border border-border py-2 text-[13px] font-medium text-text hover:bg-surface-subtle">
                Cancel
              </button>
              <button type="button" className="flex-1 rounded-md border border-border py-2 text-[13px] font-medium text-text hover:bg-surface-subtle">
                Save as Draft
              </button>
              {selected.status === "suggested" && (
                <button
                  type="button"
                  disabled={busy === selected.id || activeCount >= (data?.limits.activePrompts ?? 1)}
                  onClick={() => void activatePrompt(selected.id)}
                  className="flex-1 rounded-md bg-[#16A34A] py-2 text-[13px] font-semibold text-white hover:bg-[#15803D] disabled:opacity-50"
                >
                  {busy === selected.id ? "Saving…" : "Save & Set Active"}
                </button>
              )}
              {selected.status === "active" && (
                <button type="button" className="flex-1 rounded-md bg-[#16A34A] py-2 text-[13px] font-semibold text-white hover:bg-[#15803D]">
                  Save & Set Active
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden items-center justify-center rounded-lg border border-dashed border-border bg-surface-subtle/50 p-3.5 text-[13px] text-text-muted xl:flex">
            Select a prompt to edit
          </div>
        )}
      </div>

      {(data?.suggestedPrompts ?? []).length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-text">Prompt Templates</h3>
            <button type="button" className="text-xs font-medium text-emerald-700 hover:underline">
              View all templates →
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "General Service Discovery", group: "Core Visibility" },
              { title: "Pricing & Cost Comparison", group: "Pricing & Services" },
              { title: "Service Quality & Reviews", group: "Service Quality" },
              { title: "Trust & Authority Check", group: "Trust & Authority" },
            ].map((t) => (
              <div key={t.title} className="rounded-lg border border-border bg-white p-3 shadow-sm">
                <p className="text-[13px] font-medium text-text">{t.title}</p>
                <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", groupColor(t.group))}>
                  {t.group}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModulePage>
  );
}
