"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  Save,
} from "lucide-react";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "basic", label: "Basic" },
  { id: "keyword", label: "Keyword" },
  { id: "grid", label: "Grid area" },
  { id: "schedule", label: "Schedule" },
  { id: "review", label: "Review" },
] as const;

const RADIUS_OPTIONS = [
  { label: "1 mi", meters: 1609 },
  { label: "2 mi", meters: 3219 },
  { label: "3 mi", meters: 4828 },
  { label: "5 mi", meters: 8047 },
  { label: "10 mi", meters: 16093 },
] as const;

const KEYWORD_SUGGESTIONS = [
  {
    category: "Core service",
    terms: ["service near me", "best service", "emergency service"],
  },
  {
    category: "High-intent local",
    terms: ["service city", "service open now", "service company"],
  },
  {
    category: "Comparison",
    terms: ["top rated service", "affordable service", "local service experts"],
  },
] as const;

export type WizardExistingCampaign = {
  id: string;
  name: string;
  schedule_type?: string;
  keywordCount?: number;
  default_grid_size?: number;
  updated_at?: string | null;
  status?: "active" | "paused" | "draft";
  locationLabel?: string;
};

function formatRadiusMiles(meters: number): string {
  return `${Math.round((meters / 1609.34) * 10) / 10} mi`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function locationFromAddress(address: string | null, fallback: string): string {
  if (!address?.trim()) return fallback;
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[parts.length - 2]?.replace(/\s+[A-Z]{2}\s+\d+.*/i, "").trim();
    if (city && city.length < 40) return city;
  }
  return parts[0] ?? fallback;
}

export function CampaignSetupWizard({
  businessId,
  onClose,
  existingCampaigns = [],
}: {
  businessId: string;
  onClose: () => void;
  existingCampaigns?: WizardExistingCampaign[];
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [gridSize, setGridSize] = useState(5);
  const [radiusMeters, setRadiusMeters] = useState(3219);
  const [scheduleType, setScheduleType] = useState<"manual" | "weekly" | "biweekly" | "monthly">(
    "monthly"
  );
  const [runBaseline, setRunBaseline] = useState(true);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/account`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const b = json.account ?? json.business ?? json;
        const nm = String(b?.name ?? "");
        const address =
          (b?.address_text as string | null) ??
          (b?.scan_center_label as string | null) ??
          null;
        if (cancelled) return;
        setBusinessName(nm);
        setLocationLabel(locationFromAddress(address, nm || "—"));
        setName((prev) => prev || (nm ? `${nm} Maps` : "Monthly Maps tracking"));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const keywords = useMemo(
    () =>
      keywordsText
        .split(/[\n,]/)
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 20),
    [keywordsText]
  );

  const scheduleLabel =
    scheduleType === "manual"
      ? "Manual only"
      : scheduleType === "weekly"
        ? "Weekly"
        : scheduleType === "biweekly"
          ? "Every 2 weeks"
          : "Monthly";

  function addSuggestion(term: string) {
    const existing = keywordsText
      .split(/[\n,]/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    if (existing.includes(term.toLowerCase())) return;
    setKeywordsText((prev) => (prev.trim() ? `${prev.trim()}\n${term}` : term));
  }

  async function createCampaign(opts: { draft: boolean; withKeywords: boolean; baseline: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim() || "Untitled campaign",
          defaultGridSize: gridSize,
          defaultRadiusMeters: radiusMeters,
          scheduleType: opts.draft ? "manual" : scheduleType,
          scheduleEnabled: opts.draft ? false : scheduleType !== "manual",
          keywordCount: opts.withKeywords ? keywords.length : 0,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      const campaignId = json.campaign?.id as string;
      setCreatedId(campaignId);

      const keywordIds: string[] = [];
      if (opts.withKeywords) {
        for (const keyword of keywords) {
          const addRes = await fetch("/api/scans/keywords/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId, keyword, campaignId }),
          });
          const addJson = await addRes.json().catch(() => ({}));
          if (addRes.ok && addJson.keyword?.id) {
            keywordIds.push(addJson.keyword.id as string);
          }
        }
      }

      if (opts.baseline && keywordIds.length) {
        for (const keywordId of keywordIds) {
          await fetch("/api/scans/run-for-keyword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId,
              keywordId,
              gridSize,
              radiusMeters,
            }),
          }).catch(() => null);
        }
      }

      setBusy(false);
      if (opts.draft) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setBusy(false);
    }
  }

  async function finish() {
    await createCampaign({ draft: false, withKeywords: true, baseline: runBaseline });
  }

  async function saveDraft() {
    if (!name.trim()) {
      setError("Add a campaign name before saving a draft.");
      return;
    }
    await createCampaign({ draft: true, withKeywords: false, baseline: false });
  }

  const summaryRows = [
    {
      label: "Campaign",
      value: name.trim() || "Not named yet",
      ready: Boolean(name.trim()),
    },
    {
      label: "Location",
      value:
        businessName && locationLabel
          ? `${businessName}, ${locationLabel}`
          : businessName || locationLabel || "Loading…",
      ready: Boolean(businessName || locationLabel),
    },
    {
      label: "Keywords",
      value: keywords.length ? `${keywords.length} added` : "Not added yet",
      ready: keywords.length > 0,
    },
    {
      label: "Schedule",
      value: step >= 3 ? scheduleLabel : "Not scheduled",
      ready: step >= 3,
    },
    {
      label: "Review",
      value:
        step >= 4
          ? runBaseline
            ? "Ready to publish with baseline"
            : "Ready to publish"
          : "Not ready to publish campaign",
      ready: step >= 4,
    },
  ];

  return (
    <div className="space-y-5">
      <div className={cn(mock.card, "overflow-hidden")}>
        {/* Stepper */}
        <div className="border-b border-[#F2F4F7] px-5 py-4">
          <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step || Boolean(createdId);
              return (
                <li key={s.id} className="flex min-w-0 items-center sm:flex-1">
                  <button
                    type="button"
                    disabled={Boolean(createdId) || i > step}
                    onClick={() => i <= step && setStep(i)}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                        active || done
                          ? "bg-[#137752] text-white"
                          : "bg-[#F2F4F7] text-[#667085]"
                      )}
                    >
                      {done && !active ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[13px] font-semibold",
                        active ? "text-[#101828]" : "text-[#667085]"
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 ? (
                    <span
                      className={cn(
                        "mx-2 hidden h-px flex-1 sm:block",
                        i < step ? "bg-[#137752]" : "bg-[#E6EAF0]"
                      )}
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        {error ? (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {error}
          </div>
        ) : null}

        {createdId ? (
          <div className="space-y-3 px-5 py-6">
            <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3.5">
              <p className="text-sm font-semibold text-[#027A48]">Campaign created</p>
              <p className="mt-0.5 text-sm text-[#027A48]/90">
                Baseline scans continue in the background when enabled.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/campaigns/${createdId}`} className={mock.btnPrimary}>
                Open campaign
              </a>
              <button type="button" onClick={onClose} className={mock.btnSecondary}>
                Back to campaigns
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
              {/* Left: step content */}
              <div className="space-y-4 border-b border-[#F2F4F7] px-5 py-5 lg:border-b-0 lg:border-r">
                {step === 0 ? (
                  <>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#101828]">
                        Let’s start with basics
                      </h2>
                      <p className="mt-1 text-sm text-[#667085]">
                        Give your campaign a name and confirm the location.
                      </p>
                    </div>
                    <label className="block">
                      <span className="text-[13px] font-semibold text-[#344054]">
                        Campaign name
                      </span>
                      <input
                        className="mt-1.5 h-11 w-full rounded-lg border border-[#E6EAF0] bg-white px-3 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Soft Re-Newal Building"
                      />
                      <p className="mt-1.5 text-[12px] text-[#98A2B3]">
                        Use a unique name for this title.
                      </p>
                    </label>
                    <div className="rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] px-3.5 py-3">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                        Location
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#101828]">
                        {businessName || "Loading location…"}
                      </p>
                      <p className="text-[12px] text-[#667085]">{locationLabel || "—"}</p>
                    </div>
                  </>
                ) : null}

                {step === 1 ? (
                  <>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#101828]">Add keywords</h2>
                      <p className="mt-1 text-sm text-[#667085]">
                        Track the search terms that matter for this location.
                      </p>
                    </div>
                    <label className="block">
                      <span className="text-[13px] font-semibold text-[#344054]">
                        Keywords (one per line)
                      </span>
                      <textarea
                        className="mt-1.5 min-h-[120px] w-full rounded-lg border border-[#E6EAF0] bg-white px-3 py-2.5 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25"
                        value={keywordsText}
                        onChange={(e) => setKeywordsText(e.target.value)}
                        placeholder={"plumber near me\nemergency plumber\nplumber austin"}
                      />
                    </label>
                    <div className="space-y-2 rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                        Suggestions by category
                      </p>
                      {KEYWORD_SUGGESTIONS.map((group) => (
                        <div key={group.category}>
                          <p className="text-[12px] font-medium text-[#475467]">
                            {group.category}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {group.terms.map((term) => (
                              <button
                                key={term}
                                type="button"
                                onClick={() => addSuggestion(term)}
                                className="rounded-full border border-[#E6EAF0] bg-white px-2.5 py-1 text-[11px] font-medium text-[#344054] hover:border-[#137752]/30 hover:bg-[#ECFDF3] hover:text-[#027A48]"
                              >
                                + {term}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#101828]">Grid area</h2>
                      <p className="mt-1 text-sm text-[#667085]">
                        Choose the default grid size and scan radius for this campaign.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[13px] font-semibold text-[#344054]">Grid size</span>
                        <select
                          className="mt-1.5 h-11 w-full rounded-lg border border-[#E6EAF0] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#137752]"
                          value={gridSize}
                          onChange={(e) => setGridSize(Number(e.target.value))}
                        >
                          {[3, 5, 7, 9, 13].map((n) => (
                            <option key={n} value={n}>
                              {n}×{n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-semibold text-[#344054]">Radius</span>
                        <select
                          className="mt-1.5 h-11 w-full rounded-lg border border-[#E6EAF0] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#137752]"
                          value={radiusMeters}
                          onChange={(e) => setRadiusMeters(Number(e.target.value))}
                        >
                          {RADIUS_OPTIONS.map((option) => (
                            <option key={option.meters} value={option.meters}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-[12px] text-[#98A2B3]">
                          Measured from the map center to the outer grid edge.
                        </p>
                      </label>
                    </div>
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#101828]">Schedule</h2>
                      <p className="mt-1 text-sm text-[#667085]">
                        Decide how often Maps scans should run for this campaign.
                      </p>
                    </div>
                    <label className="block">
                      <span className="text-[13px] font-semibold text-[#344054]">
                        Recurring schedule
                      </span>
                      <select
                        className="mt-1.5 h-11 w-full rounded-lg border border-[#E6EAF0] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#137752]"
                        value={scheduleType}
                        onChange={(e) =>
                          setScheduleType(
                            e.target.value as "manual" | "weekly" | "biweekly" | "monthly"
                          )
                        }
                      >
                        <option value="manual">Manual only</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <p className="mt-1.5 text-[12px] text-[#98A2B3]">
                        Recurring scans feed the monthly report workflow.
                      </p>
                    </label>
                  </>
                ) : null}

                {step === 4 ? (
                  <>
                    <div>
                      <h2 className="text-[18px] font-bold text-[#101828]">Review & publish</h2>
                      <p className="mt-1 text-sm text-[#667085]">
                        Confirm details, then create the campaign.
                      </p>
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] px-3.5 py-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={runBaseline}
                        onChange={(e) => setRunBaseline(e.target.checked)}
                      />
                      <span>
                        <span className="text-sm font-semibold text-[#101828]">
                          Run baseline scans
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[#667085]">
                          Establish starting ranks for each keyword so next month has a
                          comparison.
                        </span>
                      </span>
                    </label>
                    <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-3.5 py-3 text-sm text-[#027A48]">
                      <p className="font-semibold text-[#027A48]">{name.trim() || "Untitled"}</p>
                      <p className="mt-1">
                        {gridSize}×{gridSize} · {formatRadiusMiles(radiusMeters)} · {scheduleLabel}
                      </p>
                      <p className="mt-0.5">
                        {keywords.length
                          ? `${keywords.length} keyword${keywords.length === 1 ? "" : "s"}`
                          : "No keywords yet"}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Right: summary */}
              <aside className="bg-[#FCFCFD] px-5 py-5">
                <h3 className="text-[16px] font-bold text-[#101828]">Campaign summary</h3>
                <p className="mt-0.5 text-sm text-[#667085]">
                  Check your details before you continue.
                </p>
                <ul className="mt-4 space-y-3">
                  {summaryRows.map((row) => (
                    <li key={row.label} className="flex items-start gap-2.5">
                      {row.ready ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#98A2B3]" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                          {row.label}
                        </p>
                        <p className="truncate text-[13px] font-medium text-[#101828]">
                          {row.value}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl border border-[#E6EAF0] bg-white px-3.5 py-3">
                  <p className="text-[13px] font-semibold text-[#101828]">What happens next?</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">
                    {step === 0
                      ? "Keywords and grid size setup follow this basic step."
                      : step === 1
                        ? "Next you’ll set the default grid area for Maps scans."
                        : step === 2
                          ? "Next you’ll choose a recurring schedule."
                          : step === 3
                            ? "Next you’ll review and publish the campaign."
                            : "Create the campaign to start tracking ranks."}
                  </p>
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F4F7] px-5 py-3.5">
              <button
                type="button"
                className={mock.btnSecondary}
                onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
                disabled={busy}
              >
                {step === 0 ? "Cancel" : "Back"}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={mock.btnSecondary}
                  disabled={busy || !name.trim()}
                  onClick={() => void saveDraft()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save draft
                </button>
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    className={mock.btnPrimary}
                    disabled={!name.trim()}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={mock.btnPrimary}
                    disabled={busy || !name.trim()}
                    onClick={() => void finish()}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create campaign
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Your campaign list (mockup bottom section) */}
      <section className={cn(mock.card, "overflow-hidden")}>
        <div className="border-b border-[#F2F4F7] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#101828]">Your campaign</h2>
          <p className="mt-0.5 text-sm text-[#667085]">
            Manage all campaigns and view their stats details.
          </p>
        </div>
        {!existingCampaigns.length ? (
          <p className="px-5 py-8 text-center text-sm text-[#667085]">
            No campaigns yet — finish setup above to create your first one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className={mock.tableHead}>
                  <th className="px-5 py-3 font-semibold">Campaign</th>
                  <th className="px-5 py-3 font-semibold">Keywords</th>
                  <th className="px-5 py-3 font-semibold">Grid size</th>
                  <th className="px-5 py-3 font-semibold">Last activity</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {existingCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F9FAFB]/80">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-[14px] font-semibold text-[#101828] hover:text-[#137752]"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-[#667085]">
                        {c.locationLabel || locationLabel || businessName || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#344054]">
                      {c.keywordCount != null
                        ? `${c.keywordCount} keyword${c.keywordCount === 1 ? "" : "s"}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-[#344054]">
                      {c.default_grid_size
                        ? `${c.default_grid_size} × ${c.default_grid_size}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-[#475467]">
                      {formatWhen(c.updated_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "text-[13px] font-semibold",
                          c.status === "paused" ? "text-[#B54708]" : "text-[#027A48]"
                        )}
                      >
                        {c.status === "paused"
                          ? "Paused"
                          : c.status === "draft"
                            ? "Draft"
                            : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
                        aria-label="Open campaign"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Page chrome used while the wizard is open (matches mockup header). */
export function MapsCampaignsWizardPageHeader({
  onNewCampaign,
}: {
  onNewCampaign?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className={mock.title}>Maps Campaigns</h1>
        <p className={mock.subtitle}>
          Comprehensive insights, analytics, and track everything related to SEO for local
          business.
        </p>
      </div>
      {onNewCampaign ? (
        <button type="button" onClick={onNewCampaign} className={cn(mock.btnPrimary, "shrink-0")}>
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      ) : (
        <span className={cn(mock.btnPrimary, "shrink-0 opacity-60")}>
          <Plus className="h-4 w-4" />
          New campaign
        </span>
      )}
    </div>
  );
}
