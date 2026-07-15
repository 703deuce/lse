"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ContactsImportWizard } from "@/components/reputation/contacts-import-wizard";

type ContactRow = {
  id: string;
  customer_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  email_normalized: string | null;
  sms_opt_out: boolean;
  email_unsubscribed: boolean;
  tags: string[];
  updated_at: string;
};

export function ContactsPageClient({
  businessId,
  allowed,
}: {
  businessId: string;
  allowed: boolean;
}) {
  const [items, setItems] = useState<ContactRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (!allowed) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ businessId, limit: "50" });
        if (q.trim()) params.set("q", q.trim());
        if (!opts?.reset && cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/reputation/contacts?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setItems((prev) => (opts?.reset || !cursor ? json.items ?? [] : [...prev, ...(json.items ?? [])]));
        setNextCursor(json.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [allowed, businessId, cursor, q]
  );

  useEffect(() => {
    setCursor(null);
    void load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search on mount / allowed
  }, [allowed, businessId]);

  if (!allowed) {
    return <ReviewCampaignsUpgrade businessId={businessId} />;
  }

  async function saveContact() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          firstName,
          lastName,
          phone,
          email,
          consentState: "express",
          consentSource: "manual_entry",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setShowAdd(false);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setCursor(null);
      await load({ reset: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModulePage>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Contacts"
          subtitle="Customers eligible for review campaigns. Opted-out contacts stay suppressed even after CSV re-upload."
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, email…"
          className="h-8 w-full max-w-xs rounded-md border border-zinc-200 px-2.5 text-[13px]"
        />
        <button
          type="button"
          onClick={() => {
            setCursor(null);
            void load({ reset: true });
          }}
          className="h-8 rounded-md border border-zinc-200 px-2.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Search
        </button>
      </div>

      {showImport && (
        <div className="mt-3">
          <ContactsImportWizard
            businessId={businessId}
            onDone={() => {
              setCursor(null);
              void load({ reset: true });
            }}
          />
        </div>
      )}

      {showAdd && (
        <div className="mt-3 grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-4">
          <input
            className="h-8 rounded-md border border-zinc-200 px-2 text-[13px]"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="h-8 rounded-md border border-zinc-200 px-2 text-[13px]"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className="h-8 rounded-md border border-zinc-200 px-2 text-[13px]"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="h-8 rounded-md border border-zinc-200 px-2 text-[13px]"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveContact()}
            className="h-8 rounded-md bg-emerald-600 px-2.5 text-[12px] font-semibold text-white disabled:opacity-60 sm:col-span-4 sm:w-fit"
          >
            {saving ? "Saving…" : "Save contact"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-[12px]">
          <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2.5 py-2 font-medium">Customer</th>
              <th className="px-2.5 py-2 font-medium">Phone</th>
              <th className="px-2.5 py-2 font-medium">Email</th>
              <th className="px-2.5 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-zinc-50">
                <td className="px-2.5 py-1.5 font-medium text-zinc-900">
                  {c.customer_name ||
                    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </td>
                <td className="px-2.5 py-1.5 tabular-nums text-zinc-700">{c.phone_e164 || "—"}</td>
                <td className="px-2.5 py-1.5 text-zinc-700">{c.email_normalized || "—"}</td>
                <td className="px-2.5 py-1.5 text-zinc-600">
                  {c.sms_opt_out || c.email_unsubscribed ? "Suppressed" : "Active"}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2.5 py-8 text-center text-zinc-500">
                  No contacts yet. Add a customer or import via a campaign.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      )}
      {nextCursor && (
        <button
          type="button"
          className="mt-2 text-[12px] font-medium text-emerald-700 hover:underline"
          onClick={() => {
            setCursor(nextCursor);
            void load();
          }}
        >
          Load more
        </button>
      )}
    </ModulePage>
  );
}
