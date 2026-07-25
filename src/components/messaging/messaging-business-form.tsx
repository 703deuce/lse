"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rep } from "@/components/reputation/rep-ui";
import type { MessagingBusinessForm, MessagingProgressStep, MessagingRegistration } from "@/lib/messaging/types";
import { Field, MessagingPageShell, SectionCard } from "./messaging-ui";

const IDENTITY_OPTIONS = [
  { id: "private", label: "Private company" },
  { id: "public", label: "Public company" },
  { id: "nonprofit", label: "Nonprofit" },
  { id: "government", label: "Government" },
  { id: "sole_proprietor", label: "Sole proprietor" },
] as const;

export function MessagingBusinessFormScreen({
  businessId,
  registration,
  progress,
  onSave,
  saving,
  error,
}: {
  businessId: string;
  registration: MessagingRegistration;
  progress: MessagingProgressStep[];
  onSave: (business: MessagingBusinessForm) => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<MessagingBusinessForm>(registration.business);

  function update<K extends keyof MessagingBusinessForm>(key: K, value: MessagingBusinessForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <MessagingPageShell
      title="Business information"
      subtitle="This becomes your Secondary Customer Profile. Use the customer’s legal information, not Local SEO Express."
      steps={progress}
      currentId="business_details"
    >
      <SectionCard title="Company details">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Legal business name">
            <input className={rep.input} value={form.legalBusinessName} onChange={(e) => update("legalBusinessName", e.target.value)} />
          </Field>
          <Field label="DBA / public-facing name">
            <input className={rep.input} value={form.dbaName} onChange={(e) => update("dbaName", e.target.value)} />
          </Field>
          <Field label="Business type">
            <select className={rep.select + " w-full"} value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
              <option value="">Select type</option>
              <option value="LLC">LLC</option>
              <option value="Corporation">Corporation</option>
              <option value="Partnership">Partnership</option>
              <option value="Sole Proprietorship">Sole Proprietorship</option>
            </select>
          </Field>
          <Field label="EIN">
            <input className={rep.input} value={form.ein} onChange={(e) => update("ein", e.target.value)} placeholder="12-3456789" />
          </Field>
          <Field label="Registration country">
            <input className={rep.input} value={form.registrationCountry} onChange={(e) => update("registrationCountry", e.target.value)} />
          </Field>
          <Field label="Business industry">
            <input className={rep.input} value={form.businessIndustry} onChange={(e) => update("businessIndustry", e.target.value)} />
          </Field>
          <Field label="Website">
            <input className={rep.input} value={form.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Regions of operation" hint="Comma-separated state codes">
            <input
              className={rep.input}
              value={form.regionsOfOperation.join(", ")}
              onChange={(e) =>
                update(
                  "regionsOfOperation",
                  e.target.value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
                )
              }
            />
          </Field>
          <Field label="Address line 1">
            <input className={rep.input} value={form.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <input className={rep.input} value={form.addressLine2} onChange={(e) => update("addressLine2", e.target.value)} />
          </Field>
          <Field label="City">
            <input className={rep.input} value={form.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="State / region">
            <input className={rep.input} value={form.region} onChange={(e) => update("region", e.target.value)} />
          </Field>
          <Field label="Postal code">
            <input className={rep.input} value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Authorized representative">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name">
            <input className={rep.input} value={form.authRepFullName} onChange={(e) => update("authRepFullName", e.target.value)} />
          </Field>
          <Field label="Job title">
            <input className={rep.input} value={form.authRepJobTitle} onChange={(e) => update("authRepJobTitle", e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={rep.input} type="email" value={form.authRepEmail} onChange={(e) => update("authRepEmail", e.target.value)} />
          </Field>
          <Field label="Phone number">
            <input className={rep.input} value={form.authRepPhone} onChange={(e) => update("authRepPhone", e.target.value)} />
          </Field>
          <Field label="Role within the company">
            <input className={rep.input} value={form.authRepRole} onChange={(e) => update("authRepRole", e.target.value)} />
          </Field>
          <Field label="Brand verification email" hint="Used for brand contact 2FA when required">
            <input className={rep.input} type="email" value={form.brandContactEmail} onChange={(e) => update("brandContactEmail", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Business identity">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {IDENTITY_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E6EAF0] px-3 py-2.5 text-sm text-[#344054]"
            >
              <input
                type="radio"
                name="businessIdentity"
                checked={form.businessIdentity === option.id}
                onChange={() => update("businessIdentity", option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Certifications">
        <div className="space-y-3 text-sm text-[#344054]">
          {(
            [
              ["certAuthorized", "I am authorized to register messaging services for this business."],
              ["certAccurate", "The information provided matches official business records."],
              ["certUnderstandsDelays", "I understand that inaccurate information can delay or prevent approval."],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={form[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      {error ? <p className="text-sm text-[#B42318]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          className={rep.btnPrimary}
          onClick={() =>
            void onSave(form).then(() =>
              router.push(`/businesses/${businessId}/reputation/messaging/use-case`)
            )
          }
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
        <button
          type="button"
          disabled={saving}
          className={rep.btnSecondary}
          onClick={() => void onSave(form)}
        >
          Save draft
        </button>
      </div>
    </MessagingPageShell>
  );
}
