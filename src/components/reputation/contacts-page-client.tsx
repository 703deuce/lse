"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { ModulePage, TabBar } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ContactsImportWizard } from "@/components/reputation/contacts-import-wizard";

type ContactTab =
  | "all"
  | "eligible"
  | "requested"
  | "detected"
  | "opted_out"
  | "import_history";

const CONTACT_TABS: Array<{ id: ContactTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "eligible", label: "Eligible for request" },
  { id: "requested", label: "Review requested" },
  { id: "detected", label: "Review detected" },
  { id: "opted_out", label: "Opted out" },
  { id: "import_history", label: "Import history" },
];

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
  source?: string | null;
  last_contacted_at?: string | null;
  campaign_attempts?: number | null;
  latest_reply_at?: string | null;
  review_completion?: unknown;
  created_at?: string;
  updated_at: string;
};

function tagsInclude(contact: ContactRow, terms: string[]) {
  const tags = (contact.tags ?? []).map((tag) => tag.toLowerCase());
  return terms.some((term) => tags.includes(term));
}

function isEligibleForRequest(contact: ContactRow) {
  return (
    (!contact.sms_opt_out && Boolean(contact.phone_e164)) ||
    (!contact.email_unsubscribed && Boolean(contact.email_normalized))
  );
}

function hasReviewRequestSignal(contact: ContactRow) {
  return (
    Boolean(contact.last_contacted_at) ||
    Number(contact.campaign_attempts ?? 0) > 0 ||
    tagsInclude(contact, ["review_requested", "request_sent", "campaign_requested"])
  );
}

function hasReviewDetectedSignal(contact: ContactRow) {
  return Boolean(contact.review_completion) || tagsInclude(contact, ["review_detected", "reviewed"]);
}

function hasImportSignal(contact: ContactRow) {
  const source = contact.source?.toLowerCase() ?? "";
  return (
    source.includes("csv") ||
    source.includes("import") ||
    tagsInclude(contact, ["imported", "csv_import"])
  );
}

function contactStatus(contact: ContactRow) {
  if (contact.sms_opt_out && contact.email_unsubscribed) return "SMS + email suppressed";
  if (contact.sms_opt_out) return "SMS suppressed";
  if (contact.email_unsubscribed) return "Email suppressed";
  if (hasReviewDetectedSignal(contact)) return "Review detected";
  if (hasReviewRequestSignal(contact)) return "Review requested";
  return "Active";
}

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
  const [activeTab, setActiveTab] = useState<ContactTab>("all");

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

  const visibleItems = useMemo(() => {
    switch (activeTab) {
      case "eligible":
        return items.filter(isEligibleForRequest);
      case "requested":
        return items.filter(hasReviewRequestSignal);
      case "detected":
        return items.filter(hasReviewDetectedSignal);
      case "opted_out":
        return items.filter((c) => c.sms_opt_out || c.email_unsubscribed);
      case "import_history":
        return items.filter(hasImportSignal);
      case "all":
      default:
        return items;
    }
  }, [activeTab, items]);

  const emptyMessage = useMemo(() => {
    if (activeTab === "eligible") {
      return "No eligible contacts in the loaded results. Contacts need at least one unsuppressed phone or email.";
    }
    if (activeTab === "requested") {
      return "No loaded contacts show review-request history. The API exposes last_contacted_at and campaign_attempts when available.";
    }
    if (activeTab === "detected") {
      return "No loaded contacts show detected review completion. Review detection appears when review_completion or matching tags are returned.";
    }
    if (activeTab === "opted_out") {
      return "No loaded contacts are opted out or unsubscribed.";
    }
    if (activeTab === "import_history") {
      return "No import-sourced contacts found in the loaded results. Batch import history is not returned by this contacts endpoint.";
    }
    return "No contacts yet. Add a customer or import via a campaign.";
  }, [activeTab]);

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
            className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0f6344]"
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
            className="h-8 rounded-full bg-[#137752] px-2.5 text-[12px] font-semibold text-white disabled:opacity-60 sm:col-span-4 sm:w-fit"
          >
            {saving ? "Saving…" : "Save contact"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      <TabBar tabs={CONTACT_TABS} active={activeTab} onChange={setActiveTab} className="mt-4" />

      <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
        Filters are applied client-side to the loaded contacts. Use Load more to bring additional contacts into these tabs.
        {activeTab === "import_history"
          ? " Import batch records are not included in /api/reputation/contacts, so this tab uses contact source/tags where present."
          : null}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
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
            {visibleItems.map((c) => (
              <tr key={c.id} className="border-b border-zinc-50">
                <td className="px-2.5 py-1.5 font-medium text-zinc-900">
                  {c.customer_name ||
                    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    "—"}
                  {c.source ? (
                    <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-normal text-zinc-500">
                      {c.source}
                    </span>
                  ) : null}
                </td>
                <td className="px-2.5 py-1.5 tabular-nums text-zinc-700">{c.phone_e164 || "—"}</td>
                <td className="px-2.5 py-1.5 text-zinc-700">{c.email_normalized || "—"}</td>
                <td className="px-2.5 py-1.5 text-zinc-600">
                  {contactStatus(c)}
                  {c.last_contacted_at ? (
                    <span className="block text-[10px] text-zinc-400">
                      Last requested {new Date(c.last_contacted_at).toLocaleDateString()}
                    </span>
                  ) : null}
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
            {!loading && visibleItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2.5 py-8 text-center text-zinc-500">
                  {emptyMessage}
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
            void load({ cursor: nextCursor });
          }}
        >
          Load more
        </button>
      )}
    </ModulePage>
  );
}
