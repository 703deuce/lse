"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Award,
  Bot,
  FileSearch,
  FileText,
  FolderKanban,
  Link2,
  Loader2,
  Radar,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { JourneyBreadcrumbs } from "@/components/journey/journey-breadcrumbs";
import { NextBestActionsPanel } from "@/components/journey/next-best-actions-panel";
import { ProspectAuditWizard } from "@/components/accounts/prospect-audit-wizard";
import { ConvertToClientWizard } from "@/components/accounts/convert-to-client-wizard";
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/accounts/types";
import type { NextBestAction } from "@/lib/journey/next-best-actions";
import { btnPrimary, btnSecondary } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  website_url?: string | null;
  phone?: string | null;
  address_text?: string | null;
  scan_center_label?: string | null;
  account_type?: string | null;
  prospect_status?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  notes?: string | null;
  archived_at?: string | null;
};

export function AccountDetail({
  businessId,
  mode,
}: {
  businessId: string;
  mode: "prospect" | "client";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [prospectStatus, setProspectStatus] = useState<ProspectStatus>("new");
  const [showAudit, setShowAudit] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [nba, setNba] = useState<NextBestAction[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acctRes, campRes, nbaRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/account`),
        fetch(`/api/campaigns?businessId=${businessId}`),
        fetch(`/api/journey/next-actions?businessId=${businessId}&mode=${mode}`),
      ]);
      const acctJson = await acctRes.json();
      if (!acctRes.ok) throw new Error(acctJson.error ?? "Failed to load");
      const a = acctJson.account as Account;
      setAccount(a);
      setNotes(a.notes ?? "");
      setContactName(a.primary_contact_name ?? "");
      setContactEmail(a.primary_contact_email ?? "");
      setProspectStatus((a.prospect_status as ProspectStatus) || "new");

      if (campRes.ok) {
        const campJson = await campRes.json();
        setCampaigns(campJson.campaigns ?? []);
      }
      if (nbaRes.ok) {
        const nbaJson = await nbaRes.json();
        setNba((nbaJson.actions ?? []) as NextBestAction[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("audit") === "1") setShowAudit(true);
    if (searchParams.get("convert") === "1") setShowConvert(true);
    if (searchParams.get("setup") === "1" && mode === "client") {
      /* post-convert highlight — keep NBA visible */
    }
  }, [searchParams, mode]);

  async function saveDetails() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          primaryContactName: contactName || null,
          primaryContactEmail: contactEmail || null,
          prospectStatus: mode === "prospect" ? prospectStatus : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const tabs = useMemo(() => {
    const base = `/businesses/${businessId}`;
    if (mode === "prospect") {
      return [
        { href: `/prospects/${businessId}`, label: "Overview" },
        { href: `${base}/scans`, label: "Maps" },
        { href: `${base}/growth-audit`, label: "Growth Audit" },
        { href: `${base}/keywords`, label: "Research" },
        { href: `${base}/ai-visibility`, label: "AI Visibility" },
        { href: `${base}/reports`, label: "Reports" },
        { href: `/prospects/${businessId}#notes`, label: "Notes" },
      ];
    }
    return [
      { href: `/clients/${businessId}`, label: "Overview" },
      { href: `${base}/scans`, label: "Maps" },
      { href: `${base}/campaigns`, label: "Campaigns" },
      { href: `${base}/growth-audit`, label: "Growth Audit" },
      { href: `${base}/reviews`, label: "Reviews" },
      { href: `${base}/backlink-gap`, label: "Backlinks" },
      { href: `${base}/trust`, label: "Local Trust" },
      { href: `${base}/keywords`, label: "Keywords" },
      { href: `${base}/ai-visibility`, label: "AI Visibility" },
      { href: `${base}/competitors`, label: "Competitors" },
      { href: `${base}/reports`, label: "Reports" },
      { href: `/clients/${businessId}#notes`, label: "Notes" },
    ];
  }, [businessId, mode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!account) {
    return <p className="text-sm text-red-600">{error ?? "Not found"}</p>;
  }

  const location =
    account.address_text?.trim() || account.scan_center_label?.trim() || "—";

  return (
    <>
      <JourneyBreadcrumbs
        items={[
          { label: mode === "prospect" ? "Prospects" : "Clients", href: mode === "prospect" ? "/prospects" : "/clients" },
          { label: account.name },
        ]}
      />

      <PageHeader
        title={account.name}
        subtitle={location}
        actions={
          <div className="flex flex-wrap gap-2">
            {mode === "prospect" ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowAudit(true)}
                  className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
                >
                  <Radar className="h-3.5 w-3.5" />
                  Run Prospect Audit
                </button>
                <Link
                  href={`/businesses/${businessId}/reports?type=single_scan`}
                  className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Create Report
                </Link>
                <button
                  type="button"
                  onClick={() => setShowConvert(true)}
                  className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Convert to Client
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/businesses/${businessId}/scans`}
                  className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
                >
                  <Radar className="h-3.5 w-3.5" />
                  Run Maps Scan
                </Link>
                <Link
                  href={`/businesses/${businessId}/reports?type=trend`}
                  className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Create Report
                </Link>
                <Link
                  href={`/businesses/${businessId}/overview`}
                  className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
                >
                  Location dashboard
                </Link>
              </>
            )}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {showAudit && mode === "prospect" ? (
        <div className="mb-4">
          <ProspectAuditWizard
            businessId={businessId}
            businessName={account.name}
            onClose={() => {
              setShowAudit(false);
              router.replace(`/prospects/${businessId}`);
            }}
          />
        </div>
      ) : null}

      {showConvert && mode === "prospect" ? (
        <div className="mb-4">
          <ConvertToClientWizard
            businessId={businessId}
            businessName={account.name}
            onClose={() => {
              setShowConvert(false);
              router.replace(`/prospects/${businessId}`);
            }}
          />
        </div>
      ) : null}

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-zinc-200 pb-2 text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="rounded-md px-2.5 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(mode === "prospect"
              ? [
                  { href: `/businesses/${businessId}/scans`, icon: Radar, label: "Maps Scans", hint: "Baseline visibility" },
                  { href: `/businesses/${businessId}/growth-audit`, icon: FileSearch, label: "Growth Audit", hint: "Find pitch opportunities" },
                  { href: `/businesses/${businessId}/ai-visibility`, icon: Sparkles, label: "AI Visibility", hint: "Optional mentions" },
                  { href: `/businesses/${businessId}/competitors`, icon: Bot, label: "Competitors", hint: "Pack share" },
                  { href: `/businesses/${businessId}/reports`, icon: FileText, label: "Reports", hint: "Shareable audits" },
                  { href: `/businesses/${businessId}/keywords`, icon: FolderKanban, label: "Keywords", hint: "Research terms" },
                ]
              : [
                  { href: `/businesses/${businessId}/scans`, icon: Radar, label: "Maps Scans", hint: "Run / compare grids" },
                  { href: `/businesses/${businessId}/campaigns`, icon: FolderKanban, label: "Campaigns", hint: "Recurring tracking" },
                  { href: `/businesses/${businessId}/growth-audit`, icon: FileSearch, label: "Growth Audit", hint: "Opportunities + tasks" },
                  { href: `/businesses/${businessId}/backlink-gap`, icon: Link2, label: "Backlink Gap", hint: "Authority opportunities" },
                  { href: `/businesses/${businessId}/trust`, icon: Award, label: "Local Trust", hint: "Market credibility" },
                  { href: `/businesses/${businessId}/reviews`, icon: Star, label: "Reviews", hint: "Feed + momentum" },
                  { href: `/businesses/${businessId}/ai-visibility`, icon: Sparkles, label: "AI Visibility", hint: "Prompt coverage" },
                  { href: `/businesses/${businessId}/reports`, icon: FileText, label: "Reports", hint: "Monthly deliverables" },
                ]
            ).map((item) => (
              <QuickLink key={item.label} {...item} />
            ))}
          </div>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Overview</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Type</dt>
                <dd className="capitalize text-zinc-900">{account.account_type ?? mode}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Phone</dt>
                <dd className="text-zinc-900">{account.phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Website</dt>
                <dd className="truncate text-zinc-900">{account.website_url || "—"}</dd>
              </div>
              {mode === "prospect" ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="capitalize text-zinc-900">
                    {(account.prospect_status ?? "new").replace(/_/g, " ")}
                  </dd>
                </div>
              ) : null}
            </dl>

            {mode === "prospect" ? (
              <label className="mt-4 block text-sm">
                <span className="font-medium text-zinc-700">Update status</span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                  value={prospectStatus}
                  onChange={(e) => setProspectStatus(e.target.value as ProspectStatus)}
                >
                  {PROSPECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="mt-3 block text-sm">
              <span className="font-medium text-zinc-700">Primary contact</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-zinc-700">Contact email</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </label>
          </section>

          <section id="notes" className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Private notes</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Never included in shared reports unless you copy them into a report section.
            </p>
            <textarea
              className="mt-3 min-h-[120px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Waiting on decision… Primary category change…"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDetails()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save details
            </button>
          </section>
        </div>

        <div className="space-y-4">
          <NextBestActionsPanel actions={nba} title="What to do next" />

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900">Campaigns</h2>
              <Link
                href={`/businesses/${businessId}/campaigns`}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Manage
              </Link>
            </div>
            {campaigns.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No campaigns yet. Create one to group keywords, set a baseline, and schedule scans.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-zinc-900 hover:text-emerald-700"
                    >
                      {c.name}
                    </Link>
                    <span className="text-xs text-zinc-400">Open</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/businesses/${businessId}/campaigns`}
              className={cn(btnSecondary, "mt-3 h-8 w-full justify-center px-3 text-[12px]")}
            >
              {campaigns.length ? "Open campaigns" : "Create campaign"}
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: typeof Radar;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 hover:border-zinc-300 hover:bg-zinc-50/50"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        <span className="block text-[11px] text-zinc-500">{hint}</span>
      </span>
    </Link>
  );
}
