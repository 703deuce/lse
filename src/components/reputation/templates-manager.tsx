"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { renderTemplate } from "@/lib/reputation/template-vars";
import {
  ContentCard,
  btnPrimary,
  btnSecondary,
} from "@/components/ui/design-system";
import { ClientPager } from "@/components/ui/show-more-list";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

type Template = {
  id: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  is_default: boolean;
  tone?: string;
};

export function TemplatesManager({ businessId }: { businessId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unknownTokens, setUnknownTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [templatePage, setTemplatePage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reputation/templates?businessId=${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setTemplates(json.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel]
  );

  const currentTemplatePage = Math.min(
    templatePage,
    Math.max(1, Math.ceil(channelTemplates.length / PAGE_SIZE))
  );
  const pageTemplates = useMemo(() => {
    const start = (currentTemplatePage - 1) * PAGE_SIZE;
    return channelTemplates.slice(start, start + PAGE_SIZE);
  }, [channelTemplates, currentTemplatePage]);

  useEffect(() => {
    const preferred =
      channelTemplates.find((t) => t.is_default) || channelTemplates[0];
    if (preferred) {
      setActiveId(preferred.id);
      setName(preferred.name);
      setSubject(preferred.subject ?? "");
      setBody(preferred.body);
    } else {
      setActiveId(null);
      setName("");
      setSubject("");
      setBody("");
    }
    // Only re-seed editor when channel list changes — not on every activeId tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, templates]);

  useEffect(() => {
    const t = templates.find((x) => x.id === activeId);
    if (!t) return;
    setName(t.name);
    setSubject(t.subject ?? "");
    setBody(t.body);
  }, [activeId, templates]);

  const preview = useMemo(
    () =>
      renderTemplate(body, {
        first_name: "Sam",
        business_name: "Your Business",
        review_link: "https://example.com/r/demo",
        location_name: "Main Location",
      }),
    [body]
  );

  async function save(createNew = false) {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/reputation/templates", {
        method: createNew || !activeId ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createNew || !activeId
            ? { businessId, channel, name, subject, body }
            : { businessId, templateId: activeId, name, subject, body }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setWarnings(json.validation?.warnings ?? []);
      setUnknownTokens(json.validation?.unknownTokens ?? []);
      setMsg("Saved");
      await load();
      if (json.template?.id) setActiveId(json.template.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function act(action: string) {
    if (!activeId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/templates", {
        method: action === "duplicate" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, templateId: activeId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      await load();
      if (json.template?.id) setActiveId(json.template.id);
      setMsg(action.replace("_", " "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  async function testSend() {
    if (!activeId || !testTo.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "test_send",
          templateId: activeId,
          toPhone: channel === "sms" ? testTo.trim() : undefined,
          toEmail: channel === "email" ? testTo.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test send failed");
      setMsg("Test send queued/sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setSaving(false);
    }
  }

  async function generateAi() {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/reputation/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, tone: "friendly" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generate failed");
      setMsg("AI templates generated");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ContentCard className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {(["sms", "email"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setChannel(c);
                setTemplatePage(1);
              }}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold uppercase",
                channel === c
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {pageTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  activeId === t.id
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {t.name}
                {t.is_default ? " ★" : ""}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50"
              onClick={() => {
                setActiveId(null);
                setName(`New ${channel} template`);
                setSubject(channel === "email" ? "How was your experience?" : "");
                setBody(
                  channel === "sms"
                    ? "Hi {{first_name}}, thanks for choosing {{business_name}}. Honest feedback welcome: {{review_link}} Reply STOP to opt out."
                    : "Hi {{first_name}},\n\nThanks for choosing {{business_name}}. Leave honest feedback here:\n{{review_link}}"
                );
              }}
            >
              + New
            </button>
          </div>
          <ClientPager
            page={currentTemplatePage}
            pageSize={PAGE_SIZE}
            total={channelTemplates.length}
            onPageChange={setTemplatePage}
          />
        </div>

        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        ) : (
          <>
            <input
              className="h-8 w-full rounded-md border border-zinc-200 px-2 text-[13px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
            />
            {channel === "email" && (
              <input
                className="h-8 w-full rounded-md border border-zinc-200 px-2 text-[13px]"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
              />
            )}
            <textarea
              className="min-h-[140px] w-full rounded-md border border-zinc-200 px-2 py-1.5 text-[13px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {(warnings.length > 0 || unknownTokens.length > 0) && (
              <ul className="space-y-1 text-[11px] text-amber-800">
                {warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
                {unknownTokens.map((t) => (
                  <li key={t}>Unknown token: {`{{${t}}}`}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={saving}
                onClick={() => void generateAi()}
                className={cn(btnSecondary, "h-8 px-3 text-xs")}
              >
                Generate with AI
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(!activeId)}
                className={cn(btnPrimary, "h-8 px-3 text-xs disabled:opacity-60")}
              >
                Save
              </button>
              {activeId && (
                <>
                  <button
                    type="button"
                    className={cn(btnSecondary, "h-8 px-3 text-xs")}
                    onClick={() => void act("set_default")}
                  >
                    Set default
                  </button>
                  <button
                    type="button"
                    className={cn(btnSecondary, "h-8 px-3 text-xs")}
                    onClick={() => void act("duplicate")}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className={cn(btnSecondary, "h-8 px-3 text-xs text-red-700")}
                    onClick={() => void act("archive")}
                  >
                    Archive
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2">
              <input
                className="h-8 min-w-0 w-full flex-1 rounded-md border border-zinc-200 px-2 text-[12px] sm:min-w-[12rem]"
                placeholder={channel === "sms" ? "Test phone (+1…)" : "Test email"}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <button
                type="button"
                disabled={saving || !activeId || !testTo.trim()}
                onClick={() => void testSend()}
                className={cn(btnSecondary, "h-8 px-3 text-xs disabled:opacity-50")}
              >
                Test send
              </button>
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            {msg && <p className="text-[12px] text-emerald-700">{msg}</p>}
          </>
        )}
      </ContentCard>

      <ContentCard className="bg-zinc-50">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Live preview
        </p>
        {channel === "sms" ? (
          <div className="mx-auto mt-3 max-w-[240px] rounded-[1.5rem] border border-zinc-300 bg-white p-3 shadow-sm">
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-800">{preview}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3">
            <p className="text-[11px] font-medium text-zinc-500">Subject</p>
            <p className="text-[13px] font-semibold text-zinc-900">
              {renderTemplate(subject || "(no subject)", {
                first_name: "Sam",
                business_name: "Your Business",
                review_link: "https://example.com/r/demo",
              })}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-[12px] text-zinc-700">{preview}</p>
          </div>
        )}
        <p className="mt-3 text-[11px] text-zinc-500">
          Tokens: {"{{first_name}}"} {"{{business_name}}"} {"{{review_link}}"} {"{{location_name}}"}
        </p>
      </ContentCard>
    </div>
  );
}
