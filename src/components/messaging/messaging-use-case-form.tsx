"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MessageSquareText, Shield } from "lucide-react";
import { rep } from "@/components/reputation/rep-ui";
import type { MessagingProgressStep, MessagingRegistration, MessagingUseCaseForm } from "@/lib/messaging/types";
import { Field, MessagingPageShell, SectionCard } from "./messaging-ui";

export function MessagingUseCaseFormScreen({
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
  onSave: (useCase: MessagingUseCaseForm) => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<MessagingUseCaseForm>(registration.useCase);

  function update<K extends keyof MessagingUseCaseForm>(key: K, value: MessagingUseCaseForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSample(index: number, value: string) {
    const next = [...form.sampleMessages];
    next[index] = value;
    update("sampleMessages", next);
  }

  return (
    <MessagingPageShell
      title="Messaging use case & consent"
      subtitle="Describe your Customer Care / Review Request campaign exactly as customers experience it."
      steps={progress}
      currentId="messaging_use_case"
      registration={registration}
    >
      <SectionCard
        title="Campaign description"
        subtitle="Prefills for review requests — review and certify before submit."
        icon={FileText}
      >
        <Field label="What kinds of messages will you send?">
          <textarea
            className={rep.input + " min-h-[140px] py-2"}
            value={form.campaignDescription}
            onChange={(e) => update("campaignDescription", e.target.value)}
          />
        </Field>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Expected monthly volume">
            <input
              type="number"
              className={rep.input}
              value={form.expectedMonthlyVolume ?? ""}
              onChange={(e) => update("expectedMonthlyVolume", e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <Field label="Use case">
            <select
              className={rep.select + " w-full"}
              value={form.campaignUseCase}
              onChange={(e) => update("campaignUseCase", e.target.value)}
            >
              <option value="CUSTOMER_CARE">Customer Care / Review Request</option>
              <option value="ACCOUNT_NOTIFICATION">Account Notification</option>
            </select>
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["messagesIncludeLinks", "Messages contain links"],
              ["messagesIncludePhoneNumbers", "Messages contain phone numbers"],
              ["messagingRecurring", "Messaging is recurring"],
              ["customerCanInitiate", "Customers can initiate the conversation"],
              ["restrictedContent", "Includes promo, loan, political, or age-restricted content"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-[#E6EAF0] px-3 py-2 text-sm text-[#344054]">
              <input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Consent & compliance"
        subtitle="Twilio and The Campaign Registry require clear opt-in documentation."
        icon={Shield}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Opt-in method">
            <input className={rep.input} value={form.optInMethod} onChange={(e) => update("optInMethod", e.target.value)} />
          </Field>
          <Field label="Consent page URL">
            <input className={rep.input} value={form.consentPageUrl} onChange={(e) => update("consentPageUrl", e.target.value)} />
          </Field>
          <Field label="Privacy Policy URL">
            <input className={rep.input} value={form.privacyPolicyUrl} onChange={(e) => update("privacyPolicyUrl", e.target.value)} />
          </Field>
          <Field label="Terms & Conditions URL">
            <input className={rep.input} value={form.termsUrl} onChange={(e) => update("termsUrl", e.target.value)} />
          </Field>
          <Field label="Opt-out wording">
            <input className={rep.input} value={form.optOutWording} onChange={(e) => update("optOutWording", e.target.value)} />
          </Field>
          <Field label="Help wording">
            <input className={rep.input} value={form.helpWording} onChange={(e) => update("helpWording", e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Exact opt-in language">
            <textarea
              className={rep.input + " min-h-[110px] py-2"}
              value={form.optInLanguage}
              onChange={(e) => update("optInLanguage", e.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Sample messages"
        subtitle="At least two realistic review-request examples with STOP/HELP language."
        icon={MessageSquareText}
      >
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Field key={index} label={`Sample message ${index + 1}`}>
              <textarea
                className={rep.input + " min-h-[90px] py-2"}
                value={form.sampleMessages[index] ?? ""}
                onChange={(e) => updateSample(index, e.target.value)}
              />
            </Field>
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
              router.push(`/businesses/${businessId}/reputation/messaging/review`)
            )
          }
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
        <button type="button" disabled={saving} className={rep.btnSecondary} onClick={() => void onSave(form)}>
          Save draft
        </button>
      </div>
    </MessagingPageShell>
  );
}
