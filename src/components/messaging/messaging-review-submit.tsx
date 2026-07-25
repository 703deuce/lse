"use client";

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

      <SectionCard title="Certifications on file">
        <ul className="space-y-2 text-sm text-[#344054]">
          <li>{b.certAuthorized ? "✓" : "○"} Authorized to register messaging</li>
          <li>{b.certAccurate ? "✓" : "○"} Information matches official records</li>
          <li>{b.certUnderstandsDelays ? "✓" : "○"} Understands inaccurate info can delay approval</li>
        </ul>
      </SectionCard>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          className={rep.btnPrimary}
          onClick={() =>
            void onSubmit().then(() =>
              router.push(`/businesses/${businessId}/reputation/messaging/status`)
            )
          }
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
