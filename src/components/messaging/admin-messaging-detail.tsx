"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RepBadge, rep } from "@/components/reputation/rep-ui";
import { STATUS_LABELS, statusTone } from "@/lib/messaging/status";
import type { MessagingRegistration, MessagingRegistrationEvent } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";
import { SectionCard } from "./messaging-ui";

function Sid({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-[#101828]">{value || "—"}</p>
    </div>
  );
}

export function AdminMessagingDetail({
  businessId,
  initialRegistration,
  initialEvents,
}: {
  businessId: string;
  initialRegistration?: MessagingRegistration;
  initialEvents?: MessagingRegistrationEvent[];
}) {
  const [registration, setRegistration] = useState<MessagingRegistration | null>(
    initialRegistration ?? null
  );
  const [events, setEvents] = useState<MessagingRegistrationEvent[]>(initialEvents ?? []);
  const [notes, setNotes] = useState(initialRegistration?.adminNotes ?? "");
  const [loading, setLoading] = useState(!initialRegistration);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRegistration) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/messaging/${businessId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setRegistration(json.registration);
        setEvents(json.events ?? []);
        setNotes(json.registration?.adminNotes ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId, initialRegistration]);

  async function run(action: string, patch?: Record<string, unknown>) {
    if (!registration) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messaging/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          organizationId: registration.organizationId,
          businessName: registration.businessName,
          patch,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setRegistration(json.registration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !registration) {
    return <p className="text-sm text-[#667085]">{error ?? "Loading customer registration..."}</p>;
  }

  return (
    <div className={rep.page}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/admin/messaging" className={rep.link}>
            ← All messaging customers
          </Link>
          <h1 className={cn(rep.title, "mt-2")}>{registration.businessName}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <RepBadge tone={statusTone(registration.overallStatus)}>
              {STATUS_LABELS[registration.overallStatus]}
            </RepBadge>
            <RepBadge tone={registration.messagingEnabled ? "green" : "gray"}>
              Messaging {registration.messagingEnabled ? "enabled" : "disabled"}
            </RepBadge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={saving} className={rep.btnSecondary} onClick={() => void run("refresh")}>
            Force refresh status
          </button>
          <button
            type="button"
            disabled={saving}
            className={rep.btnSecondary}
            onClick={() => void run("override", { adminNotes: notes })}
          >
            Save notes
          </button>
          <button
            type="button"
            disabled={saving}
            className={rep.btnPrimary}
            onClick={() =>
              void run("override", {
                overallStatus: "approved",
                businessDetailsStatus: "approved",
                brandVerificationStatus: "approved",
                campaignReviewStatus: "approved",
              })
            }
          >
            Manual override approve
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <SectionCard title="Submitted application data">
          <dl className="space-y-2 text-sm text-[#344054]">
            <div><span className="font-semibold">Legal name:</span> {registration.business.legalBusinessName}</div>
            <div><span className="font-semibold">DBA:</span> {registration.business.dbaName}</div>
            <div><span className="font-semibold">EIN:</span> {registration.business.ein}</div>
            <div><span className="font-semibold">Identity:</span> {registration.business.businessIdentity}</div>
            <div><span className="font-semibold">Website:</span> {registration.business.websiteUrl}</div>
            <div>
              <span className="font-semibold">Auth rep:</span>{" "}
              {registration.business.authRepFullName} · {registration.business.authRepEmail}
            </div>
            <div><span className="font-semibold">Use case:</span> {registration.useCase.campaignUseCase}</div>
            <div><span className="font-semibold">Privacy:</span> {registration.useCase.privacyPolicyUrl}</div>
            <div><span className="font-semibold">Terms:</span> {registration.useCase.termsUrl}</div>
            <div className="pt-2">
              <p className="font-semibold">Campaign description</p>
              <p className="mt-1 text-[#667085]">{registration.useCase.campaignDescription}</p>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Twilio integration details">
          <div className="grid gap-2">
            <Sid label="Subaccount SID" value={registration.twilio.subaccountSid} />
            <Sid label="Customer Profile SID" value={registration.twilio.customerProfileSid} />
            <Sid label="Brand SID" value={registration.twilio.brandSid} />
            <Sid label="Campaign SID" value={registration.twilio.campaignSid} />
            <Sid label="Messaging Service SID" value={registration.twilio.messagingServiceSid} />
            <Sid label="Phone Number SID" value={registration.twilio.phoneNumberSid} />
            <Sid label="Profile status (raw)" value={registration.twilio.customerProfileStatus} />
            <Sid label="Brand status (raw)" value={registration.twilio.brandStatus} />
            <Sid label="Campaign status (raw)" value={registration.twilio.campaignStatus} />
            <Sid
              label="Failure reasons"
              value={
                [
                  ...registration.twilio.profileFailureReasons,
                  registration.twilio.brandFailureReason,
                  registration.twilio.campaignFailureReason,
                  registration.lastError,
                ]
                  .filter(Boolean)
                  .join(" | ") || null
              }
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <SectionCard title="Status history">
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg bg-[#F9FAFB] px-3 py-2">
                <p className="text-sm font-medium text-[#101828]">{event.message ?? event.eventType}</p>
                <p className="text-xs text-[#98A2B3]">
                  {new Date(event.createdAt).toLocaleString()} · {event.source}
                </p>
              </li>
            ))}
            {events.length === 0 ? <p className="text-sm text-[#667085]">No events yet.</p> : null}
          </ul>
        </SectionCard>
        <SectionCard title="Internal notes">
          <textarea
            className={rep.input + " min-h-[160px] py-2"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ops notes, carrier tickets, customer follow-ups..."
          />
          <p className="mt-3 text-sm text-[#667085]">
            Number: {registration.phoneNumberFriendly ?? "None"} · Adapter: {registration.adapterMode}
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
