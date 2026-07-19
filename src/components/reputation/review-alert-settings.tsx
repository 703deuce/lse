"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Settings = {
  every_new_review: boolean;
  low_rating_only: boolean;
  unanswered_only: boolean;
  daily_summary: boolean;
  weekly_summary: boolean;
  email_recipients: string[];
};

export function ReviewAlertSettings({ businessId }: { businessId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reputation/notification-settings?businessId=${businessId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load");
    setSettings(json.settings);
    setEmails((json.settings.email_recipients ?? []).join(", "));
  }, [businessId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [load]);

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/reputation/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          everyNewReview: settings.every_new_review,
          lowRatingOnly: settings.low_rating_only,
          unansweredOnly: settings.unanswered_only,
          dailySummary: settings.daily_summary,
          weeklySummary: settings.weekly_summary,
          emailRecipients: emails,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSettings(json.settings);
      setEmails((json.settings.email_recipients ?? []).join(", "));
      setMsg("Alert preferences saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-[12px] text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading alert settings…
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
      <div>
        <p className="text-[13px] font-semibold text-zinc-900">New review alerts</p>
        <p className="text-[11px] text-zinc-500">
          Emails fire from the campaign worker when new Google reviews are detected. Confirmed
          attribution still requires tracking evidence in Campaigns.
        </p>
      </div>
      {(
        [
          ["every_new_review", "Email on every new review"],
          ["low_rating_only", "Only ratings 1–3 stars"],
          ["unanswered_only", "Only unanswered reviews"],
          ["daily_summary", "Daily summary (reserved)"],
          ["weekly_summary", "Weekly summary (reserved)"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-[12px] text-zinc-700">
          <input
            type="checkbox"
            checked={Boolean(settings[key])}
            onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <label className="block text-[12px] font-medium text-zinc-700">
        Alert recipients (comma-separated)
        <input
          className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="you@business.com, ops@business.com"
        />
      </label>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      {msg && <p className="text-[12px] text-emerald-700">{msg}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Save alerts
      </button>
    </div>
  );
}
