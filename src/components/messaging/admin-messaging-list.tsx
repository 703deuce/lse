"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RepBadge, RepSearch, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS, statusTone } from "@/lib/messaging/status";
import type { MessagingRegistration } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "action_required", "in_review", "failed", "approved", "ready"] as const;

export function AdminMessagingList({
  initialRegistrations,
}: {
  initialRegistrations?: MessagingRegistration[];
}) {
  const [rows, setRows] = useState<MessagingRegistration[]>(initialRegistrations ?? []);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(!initialRegistrations);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRegistrations) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/messaging");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setRows(json.registrations ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [initialRegistrations]);

  const visible = useMemo(() => {
    return rows.filter((row) => {
      const statusMatch =
        filter === "all" ||
        row.overallStatus === filter ||
        (filter === "action_required" &&
          [row.businessDetailsStatus, row.brandVerificationStatus, row.campaignReviewStatus].includes(
            "action_required"
          ));
      const needle = q.trim().toLowerCase();
      const searchMatch =
        !needle ||
        row.businessName.toLowerCase().includes(needle) ||
        (row.phoneNumberFriendly ?? "").toLowerCase().includes(needle);
      return statusMatch && searchMatch;
    });
  }, [filter, q, rows]);

  return (
    <div className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className={rep.title}>Admin — Messaging Customers</h1>
          <p className={rep.subtitle}>
            ISV control plane for Secondary Profiles, Brands, Campaigns, numbers, and messaging readiness.
          </p>
        </div>
        <RepSearch value={q} onChange={setQ} placeholder="Search customer or number..." />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize",
              filter === id ? "bg-[#137752] text-white" : "bg-[#F2F4F7] text-[#667085]"
            )}
          >
            {id.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

      <div className={cn(rep.card, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <tr>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Profile</th>
                <th className="px-3 py-2 font-semibold">Brand</th>
                <th className="px-3 py-2 font-semibold">Campaign</th>
                <th className="px-3 py-2 font-semibold">Number</th>
                <th className="px-3 py-2 font-semibold">Messaging</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {visible.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-3 py-3 font-semibold text-[#101828]">{row.businessName}</td>
                  <td className="px-3 py-3">
                    <RepBadge tone={statusTone(row.businessDetailsStatus)}>
                      {STATUS_LABELS[row.businessDetailsStatus]}
                    </RepBadge>
                  </td>
                  <td className="px-3 py-3">
                    <RepBadge tone={statusTone(row.brandVerificationStatus)}>
                      {STATUS_LABELS[row.brandVerificationStatus]}
                    </RepBadge>
                  </td>
                  <td className="px-3 py-3">
                    <RepBadge tone={statusTone(row.campaignReviewStatus)}>
                      {STATUS_LABELS[row.campaignReviewStatus]}
                    </RepBadge>
                  </td>
                  <td className="px-3 py-3 text-[#667085]">
                    {row.phoneNumberFriendly ?? (row.phoneNumberReserved ? "Reserved" : "None")}
                  </td>
                  <td className="px-3 py-3">
                    <RepBadge tone={row.messagingEnabled ? "green" : "gray"}>
                      {row.messagingEnabled ? "Enabled" : "Disabled"}
                    </RepBadge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/admin/messaging/${row.businessId}`}
                      className={rep.link}
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-[#667085]">
                    No messaging customers match this filter.
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-[#667085]">
                    Loading...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
