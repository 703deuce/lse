"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Users } from "lucide-react";
import {
  ModuleHeader,
  ModulePage,
  btnPrimary,
  btnSecondary,
  cardClass,
} from "@/components/ui/design-system";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ContactsImportWizard } from "@/components/reputation/contacts-import-wizard";
import { ClientPager } from "@/components/ui/show-more-list";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

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
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (opts?: { reset?: boolean; cursor?: string | null }) => {
      if (!allowed) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ businessId, limit: "50" });
        if (q.trim()) params.set("q", q.trim());
        const pageCursor = opts?.reset ? null : (opts?.cursor ?? cursor);
        if (pageCursor) params.set("cursor", pageCursor);
        const res = await fetch(`/api/reputation/contacts?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setItems((prev) =>
          opts?.reset || !pageCursor ? json.items ?? [] : [...prev, ...(json.items ?? [])]
        );
        setNextCursor(json.nextCursor ?? null);
        if (pageCursor) setCursor(pageCursor);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "1") setShowImport(true);
  }, []);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(items.length / PAGE_SIZE)));
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, currentPage]);

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
      <ModuleHeader
        icon={Users}
        title="Contacts"
        subtitle="Customers eligible for review campaigns. Opted-out contacts stay suppressed even after CSV re-upload."
        actions={
          <>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className={cn(btnSecondary, "h-8 px-3 text-xs")}
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className={cn(btnPrimary, "h-8 px-3 text-xs")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Customer
          </button>
          </>
        }
      />

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
            setPage(1);
            void load({ reset: true });
          }}
          className={cn(btnSecondary, "h-8 px-3 text-xs")}
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
              setPage(1);
              void load({ reset: true });
            }}
          />
        </div>
      )}

      {showAdd && (
        <div className={cn(cardClass, "mt-3 grid gap-2 p-3 sm:grid-cols-4")}>
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
            className={cn(btnPrimary, "h-8 px-3 text-xs disabled:opacity-60 sm:col-span-4 sm:w-fit")}
          >
            {saving ? "Saving…" : "Save contact"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      <div className={cn(cardClass, "mt-3 overflow-x-auto")}>
        <table className="min-w-full text-left text-[12px]">
          <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2.5 py-2 font-medium">Customer</th>
              <th className="px-2.5 py-2 font-medium">Phone</th>
              <th className="px-2.5 py-2 font-medium">Email</th>
              <th className="px-2.5 py-2 font-medium">Status</th>
              <th className="px-2.5 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => (
              <tr key={c.id} className="border-b border-zinc-50">
                <td className="px-2.5 py-1.5 font-medium text-zinc-900">
                  {c.customer_name ||
                    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </td>
                <td className="px-2.5 py-1.5 tabular-nums text-zinc-700">{c.phone_e164 || "—"}</td>
                <td className="px-2.5 py-1.5 text-zinc-700">{c.email_normalized || "—"}</td>
                <td className="px-2.5 py-1.5 text-zinc-600">
                  {c.sms_opt_out && c.email_unsubscribed
                    ? "SMS + email suppressed"
                    : c.sms_opt_out
                      ? "SMS suppressed"
                      : c.email_unsubscribed
                        ? "Email suppressed"
                        : "Active"}
                </td>
                <td className="px-2.5 py-1.5">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-emerald-700 hover:underline"
                    onClick={() => {
                      void (async () => {
                        const suppressed = c.sms_opt_out || c.email_unsubscribed;
                        const res = await fetch("/api/reputation/contacts", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            businessId,
                            contactId: c.id,
                            action: suppressed ? "unsuppress" : "suppress",
                            channel: "both",
                          }),
                        });
                        if (res.ok) {
                          setCursor(null);
                          await load({ reset: true });
                        }
                      })();
                    }}
                  >
                    {c.sms_opt_out || c.email_unsubscribed ? "Clear suppression" : "Suppress"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2.5 py-8 text-center text-zinc-500">
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
      <ClientPager page={currentPage} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
      {nextCursor && (
        <button
          type="button"
          className={cn(btnSecondary, "mt-2 h-8 px-3 text-xs")}
          onClick={() => {
            void load({ cursor: nextCursor });
          }}
        >
          Load more
        </button>
      )}
    </ModulePage>
  );
}
