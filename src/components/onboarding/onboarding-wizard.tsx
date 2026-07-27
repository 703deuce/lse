"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  MessageSquare,
  Star,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, btnSecondary, fieldLabelClass, inputClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Step = "welcome" | "business" | "channels" | "done";

const STEPS: Step[] = ["welcome", "business", "channels", "done"];

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [businessDraft, setBusinessDraft] = useState({
    name: "",
    website: "",
    phone: "",
    city: "",
  });
  const [channels, setChannels] = useState({
    sms: true,
    email: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const newBusinessHref = useMemo(() => {
    const params = new URLSearchParams({
      as: "client",
      from: "onboarding",
      smb: "1",
    });
    if (businessDraft.name.trim()) params.set("name", businessDraft.name.trim());
    if (businessDraft.city.trim()) params.set("city", businessDraft.city.trim());
    if (businessDraft.website.trim()) params.set("website", businessDraft.website.trim());
    return `/businesses/new?${params.toString()}`;
  }, [businessDraft]);

  async function saveChannelPrefs() {
    setSaving(true);
    setError(null);
    try {
      // Soft preference only — messaging setup can refine later.
      window.sessionStorage.setItem(
        "lse_onboarding_channels",
        JSON.stringify(channels)
      );
      setStep("done");
    } catch {
      setError("Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={step === "welcome" ? "w-full" : "mx-auto max-w-2xl"}>
      {step !== "welcome" ? (
        <PageHeader
          title="Set up your business"
          subtitle="Add your business once, then send review requests and track local rankings."
        />
      ) : null}

      {step !== "welcome" ? (
        <ol className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
          {STEPS.filter((s) => s !== "welcome").map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-md border px-2 py-0.5 capitalize",
                STEPS.indexOf(s) === stepIndex
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : STEPS.indexOf(s) < stepIndex
                    ? "border-zinc-200 text-zinc-500"
                    : "border-zinc-100 text-zinc-400"
              )}
            >
              {i + 1}. {s === "channels" ? "messaging" : s}
            </li>
          ))}
        </ol>
      ) : null}

      {step === "welcome" ? (
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-[#027A48]">
            Local SEO Express
          </p>
          <h1 className="mt-3 text-center text-[32px] font-bold tracking-tight text-[#101828] sm:text-[40px]">
            Get more Google reviews and improve your local rankings
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-[#667085]">
            Send review requests by text or email, track Google Maps rankings, and find problems
            hurting your local visibility — without agency jargon.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Star,
                title: "Ask for reviews",
                body: "SMS, email, QR codes, and follow-ups so customers actually leave Google reviews.",
              },
              {
                icon: MapPin,
                title: "Track rankings",
                body: "See where you show up across your service area — not just one search result.",
              },
              {
                icon: MessageSquare,
                title: "Know what to fix",
                body: "Run a local SEO audit and get a clear list of what to improve next.",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF3] text-[#137752]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-[15px] font-bold text-[#101828]">{card.title}</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-[#667085]">{card.body}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              className={cn(btnPrimary, "h-11 px-6 text-[14px]")}
              onClick={() => setStep("business")}
            >
              Add your business <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "business" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Your business</h2>
          <p className="text-[13px] text-zinc-600">
            Tell us a few basics. Next you&apos;ll connect your Google listing so we can attach the
            right review link and ranking location.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>Business name</span>
              <input
                className={inputClass}
                value={businessDraft.name}
                onChange={(e) => setBusinessDraft((b) => ({ ...b, name: e.target.value }))}
                placeholder="Acme Plumbing"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Website</span>
              <input
                className={inputClass}
                value={businessDraft.website}
                onChange={(e) => setBusinessDraft((b) => ({ ...b, website: e.target.value }))}
                placeholder="https://"
              />
            </label>
            <label className="block">
              <span className={fieldLabelClass}>Phone</span>
              <input
                className={inputClass}
                value={businessDraft.phone}
                onChange={(e) => setBusinessDraft((b) => ({ ...b, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={fieldLabelClass}>City or service area</span>
              <input
                className={inputClass}
                value={businessDraft.city}
                onChange={(e) => setBusinessDraft((b) => ({ ...b, city: e.target.value }))}
                placeholder="Austin, TX"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("welcome")}
            >
              Back
            </button>
            <button
              type="button"
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              disabled={!businessDraft.name.trim() || !businessDraft.city.trim()}
              onClick={() => setStep("channels")}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "channels" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">How do you want to ask for reviews?</h2>
          <p className="text-[13px] text-zinc-600">
            You can change this later. SMS needs a messaging number; email works immediately for most
            accounts.
          </p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={channels.sms}
                onChange={(e) => setChannels((c) => ({ ...c, sms: e.target.checked }))}
                className="accent-[#137752]"
              />
              <span className="text-[13px] font-medium text-zinc-800">SMS text messages</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={channels.email}
                onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))}
                className="accent-[#137752]"
              />
              <span className="text-[13px] font-medium text-zinc-800">Email</span>
            </label>
          </div>
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("business")}
            >
              Back
            </button>
            <button
              type="button"
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              disabled={saving || (!channels.sms && !channels.email)}
              onClick={() => void saveChannelPrefs()}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Connect your Google listing</h2>
          <p className="text-[13px] text-zinc-600">
            Find your business on Google so we can attach the correct review link and ranking
            location. Then you&apos;ll send your first review request.
          </p>
          <ul className="space-y-2 text-[13px] text-zinc-700">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Add business details
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Choose SMS, email, or both
            </li>
            <li className="flex gap-2 text-zinc-500">
              <Check className="mt-0.5 h-4 w-4 text-zinc-300" /> Connect Google listing
            </li>
            <li className="flex gap-2 text-zinc-500">
              <Check className="mt-0.5 h-4 w-4 text-zinc-300" /> Send your first review request
            </li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={newBusinessHref} className={cn(btnPrimary, "h-9 px-3 text-[13px]")}>
              Find my Google listing <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("channels")}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
