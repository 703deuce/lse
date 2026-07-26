"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rep } from "@/components/reputation/rep-ui";
import type { MessagingProgressStep, MessagingRegistration } from "@/lib/messaging/types";
import { MessagingPageShell, SectionCard } from "./messaging-ui";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[#F2F4F7] py-2 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)]">
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">{label}</dt>
      <dd className="text-sm text-[#101828]">{value || "—"}</dd>
    </div>
  );
}

export function MessagingReviewSubmit({
  businessId,
  registration,
  progress,
  onSubmit,
  saving,
  error,
}: {
  businessId: string;
  registration: MessagingRegistration;
  progress: MessagingProgressStep[];
  onSubmit: () => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const b = registration.business;
  const u = registration.useCase;
  const [certAuthorized, setCertAuthorized] = useState(Boolean(b.certAuthorized));
  const [certAccurate, setCertAccurate] = useState(Boolean(b.certAccurate));
  const [certUnderstandsDelays, setCertUnderstandsDelays] = useState(
    Boolean(b.certUnderstandsDelays)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit = certAuthorized && certAccurate && certUnderstandsDelays;

  return (
    <MessagingPageShell
      title="Review & submit"
      subtitle="Confirm every detail before registration. Changes after submission require a manual review process."
      steps={progress}
      currentId="brand_verification"
    >
      <div className="rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-sm text-[#93370D]">
        Once submitted, business and campaign details cannot be silently edited. Failed registrations will show exactly what must be corrected.
      </div>

      <SectionCard title="Business information">
        <dl>
          <Row label="Legal name" value={b.legalBusinessName} />
          <Row label="DBA" value={b.dbaName} />
          <Row label="EIN" value={b.ein} />
          <Row label="Identity" value={b.businessIdentity} />
          <Row label="Website" value={b.websiteUrl} />
          <Row
            label="Address"
            value={[b.addressLine1, b.addressLine2, b.city, b.region, b.postalCode].filter(Boolean).join(", ")}
          />
        </dl>
      </SectionCard>

      <SectionCard title="Authorized representative">
        <dl>
          <Row label="Name" value={b.authRepFullName} />
          <Row label="Title" value={b.authRepJobTitle} />
          <Row label="Email" value={b.authRepEmail} />
          <Row label="Phone" value={b.authRepPhone} />
          <Row label="Brand email" value={b.brandContactEmail} />
        </dl>
      </SectionCard>

      <SectionCard title="Messaging details">
        <dl>
          <Row label="Use case" value={u.campaignUseCase} />
          <Row label="Description" value={u.campaignDescription} />
          <Row label="Monthly volume" value={u.expectedMonthlyVolume} />
          <Row label="Opt-in method" value={u.optInMethod} />
          <Row label="Privacy Policy" value={u.privacyPolicyUrl} />
          <Row label="Terms" value={u.termsUrl} />
        </dl>
      </SectionCard>

      <SectionCard title="Sample messages">
        <div className="space-y-3">
          {u.sampleMessages.filter(Boolean).map((message, index) => (
            <div key={index} className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#344054]">
              {message}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Fees and recurring costs"
        subtitle="Estimated carrier and number costs after your campaign is approved."
      >
        <dl>
          <Row label="Local phone number" value="~$1.15 / month" />
          <Row label="Brand / campaign registry" value="Carrier fees may apply at submission" />
          <Row
            label="Plan SMS allowance"
            value={`${registration.monthlySmsAllowance} messages / month included`}
          />
          <Row label="Overage" value="Billed per message after monthly allowance" />
        </dl>
      </SectionCard>

      <SectionCard
        title="Re-certification"
        subtitle="Confirm these statements again before submitting to Twilio."
      >
        <div className="space-y-3 text-sm text-[#344054]">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-[#D0D5DD] text-[#137752] focus:ring-[#137752]"
              checked={certAuthorized}
              onChange={(e) => setCertAuthorized(e.target.checked)}
            />
            <span>I am authorized to register messaging for this business.</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-[#D0D5DD] text-[#137752] focus:ring-[#137752]"
              checked={certAccurate}
              onChange={(e) => setCertAccurate(e.target.checked)}
            />
            <span>All information matches official business records.</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-[#D0D5DD] text-[#137752] focus:ring-[#137752]"
              checked={certUnderstandsDelays}
              onChange={(e) => setCertUnderstandsDelays(e.target.checked)}
            />
            <span>I understand inaccurate information can delay or block approval.</span>
          </label>
        </div>
      </SectionCard>

      {error || localError ? (
        <p className="text-sm text-[#B42318]">{error ?? localError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || !canSubmit}
          className={rep.btnPrimary}
          onClick={() => {
            if (!canSubmit) {
              setLocalError("Complete all re-certification checkboxes before submitting.");
              return;
            }
            setLocalError(null);
            void onSubmit().then(() =>
              router.push(`/businesses/${businessId}/reputation/messaging/status`)
            );
          }}
        >
          {saving ? "Submitting..." : "Submit registration"}
        </button>
        <button
          type="button"
          className={rep.btnSecondary}
          onClick={() => router.push(`/businesses/${businessId}/reputation/messaging/business`)}
        >
          Edit application
        </button>
      </div>
    </MessagingPageShell>
  );
}
