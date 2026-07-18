"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Radar,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/accounts/types";

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
  const [account, setAccount] = useState<Account | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [prospectStatus, setProspectStatus] = useState<ProspectStatus>("new");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acctRes, campRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}/account`),
        fetch(`/api/campaigns?businessId=${businessId}`),
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function convert() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/convert-to-client`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Convert failed");
      router.push(`/clients/${businessId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Convert failed");
      setSaving(false);
    }
  }

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
      <Link
        href={mode === "prospect" ? "/prospects" : "/clients"}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {mode === "prospect" ? "Prospects" : "Clients"}
      </Link>

      <PageHeader
        title={account.name}
        subtitle={location}
        actions={
          mode === "prospect" ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void convert()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Convert to client
            </button>
          ) : (
            <Link
              href={`/businesses/${businessId}/overview`}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Open dashboard
            </Link>
          )
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-zinc-200 pb-2 text-sm">
        {[
          { href: mode === "prospect" ? `/prospects/${businessId}` : `/clients/${businessId}`, label: "Overview" },
          { href: `/businesses/${businessId}/campaigns`, label: "Campaigns" },
          { href: `/businesses/${businessId}/scans`, label: "Scans" },
          { href: `/businesses/${businessId}/ai-visibility`, label: "AI Visibility" },
          { href: `/businesses/${businessId}/reports`, label: "Reports" },
          { href: `/locations/${businessId}`, label: "Location" },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="rounded-md px-2.5 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink
          href={`/businesses/${businessId}/scans`}
          icon={Radar}
          label="Scans"
          hint="Maps grids"
        />
        <QuickLink
          href={`/businesses/${businessId}/reports`}
          icon={FileText}
          label="Reports"
          hint="Branded deliverables"
        />
        <QuickLink
          href={`/businesses/${businessId}/ai-visibility`}
          icon={Sparkles}
          label="AI Visibility"
          hint="Optional mentions"
        />
        <QuickLink
          href={`/businesses/${businessId}/campaigns`}
          icon={Radar}
          label="Campaigns"
          hint="Keyword groups"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
          </dl>

          {mode === "prospect" ? (
            <label className="mt-4 block text-sm">
              <span className="font-medium text-zinc-700">Prospect status</span>
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

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Private notes</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Never included in shared reports unless you copy them into a report section.
          </p>
          <textarea
            className="mt-3 min-h-[140px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Changed primary category… Waiting on new reviews…"
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

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
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
            No campaigns yet. Keywords will group under a default campaign when you add them.
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
      </section>
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
