"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Compass,
  Loader2,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { btnPrimary, btnSecondary, fieldLabelClass, inputClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Path = "prospect" | "client" | "explore" | null;
type Step =
  | "welcome"
  | "profile"
  | "business"
  | "keywords"
  | "first_action"
  | "running"
  | "done";

const STEPS_FOR_PATH: Step[] = [
  "welcome",
  "profile",
  "business",
  "keywords",
  "first_action",
  "running",
  "done",
];

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [path, setPath] = useState<Path>(null);
  const [profile, setProfile] = useState({
    name: "",
    company: "",
    website: "",
    contactEmail: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  });
  const [keywords, setKeywords] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const stepIndex = STEPS_FOR_PATH.indexOf(step);

  const newBusinessHref = useMemo(() => {
    if (path === "prospect") return "/businesses/new?as=prospect&from=onboarding";
    if (path === "client") return "/businesses/new?as=client&from=onboarding";
    return "/businesses/new?as=client&from=onboarding";
  }, [path]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/workspace/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          footerText: profile.company || null,
          contactLine: profile.contactEmail || profile.website || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Could not save profile");
      }
      setProfileSaved(true);
      setStep("business");
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  }

  // Note: consultant name is stored on report branding; personal name can be edited in Settings.

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Welcome to Maps Rank Tracker"
        subtitle="A clear path from prospecting to client work to white-label reports — with every tool still one click away."
      />

      {step !== "welcome" ? (
        <ol className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
          {STEPS_FOR_PATH.filter((s) => s !== "welcome").map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded-md border px-2 py-0.5 capitalize",
                STEPS_FOR_PATH.indexOf(s) === stepIndex
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : STEPS_FOR_PATH.indexOf(s) < stepIndex
                    ? "border-zinc-200 text-zinc-500"
                    : "border-zinc-100 text-zinc-400"
              )}
            >
              {i + 1}. {s.replace("_", " ")}
            </li>
          ))}
        </ol>
      ) : null}

      {step === "welcome" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                id: "prospect" as const,
                icon: Target,
                title: "Audit a prospect",
                body: "Win a client with a branded Maps audit.",
              },
              {
                id: "client" as const,
                icon: Building2,
                title: "Set up an existing client",
                body: "Track keywords, schedule scans, deliver monthly reports.",
              },
              {
                id: "explore" as const,
                icon: Compass,
                title: "Explore the platform",
                body: "Browse tools first — start a location when ready.",
              },
            ] as const
          ).map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setPath(card.id);
                  if (card.id === "explore") {
                    setStep("done");
                  } else {
                    setStep("profile");
                  }
                }}
                className="rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <Icon className="h-5 w-5 text-emerald-600" />
                <p className="mt-3 text-[14px] font-semibold text-zinc-900">{card.title}</p>
                <p className="mt-1 text-[12px] leading-snug text-zinc-600">{card.body}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === "profile" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-[13px] text-zinc-600">
            This information is used in your white-label reports. You can refine branding later.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={fieldLabelClass}>Your name</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Business / consultant name</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={profile.company}
                onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Website (optional)</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={profile.website}
                onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className={fieldLabelClass}>Report contact email</span>
              <input
                type="email"
                className={cn(inputClass, "mt-1")}
                value={profile.contactEmail}
                onChange={(e) => setProfile((p) => ({ ...p, contactEmail: e.target.value }))}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className={fieldLabelClass}>Timezone</span>
              <input
                className={cn(inputClass, "mt-1")}
                value={profile.timezone}
                onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
              />
            </label>
          </div>
          {profileError ? <p className="text-[12px] text-red-600">{profileError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("welcome")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={savingProfile || !profile.company.trim()}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => void saveProfile()}
            >
              {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Continue
            </button>
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("business")}
            >
              Skip for now
            </button>
          </div>
        </div>
      ) : null}

      {step === "business" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">
            {path === "prospect" ? "Add a prospect" : "Add a client"}
          </h2>
          <p className="text-[13px] text-zinc-600">
            Search Google Business Profile to populate name, address, Place ID, website, and phone.
            {profileSaved ? " Your report branding was saved." : ""}
          </p>
          <Link href={newBusinessHref} className={cn(btnPrimary, "h-9 px-3 text-[13px]")}>
            {path === "prospect" ? "Create prospect" : "Create client"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <p className="text-[12px] text-zinc-500">
            After you save the location, come back here or open the location to add keywords and run
            the first action.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("profile")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("keywords")}
            >
              I already added a location
            </button>
          </div>
        </div>
      ) : null}

      {step === "keywords" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Starter keywords</h2>
          <p className="text-[13px] text-zinc-600">
            Enter a primary keyword and a few variations. You can refine later in Maps Campaigns —
            no need to open Keyword Research yet.
          </p>
          <textarea
            className={cn(inputClass, "min-h-[100px]")}
            placeholder={"dentist near me\nteeth cleaning\nemergency dentist\ndentist in austin"}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <p className="text-[11px] text-zinc-500">
            Tip: include a near-me variant and a city variant for the first prospect audit.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("business")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("first_action")}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "first_action" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">
            {path === "prospect" ? "Run a prospect audit" : "Set up client tracking"}
          </h2>
          {path === "prospect" ? (
            <ul className="space-y-2 text-[13px] text-zinc-700">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Baseline Maps scan
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Growth Audit
              </li>
              <li className="flex gap-2 text-zinc-500">
                <Check className="mt-0.5 h-4 w-4 text-zinc-300" /> Optional AI visibility check
              </li>
            </ul>
          ) : (
            <ul className="space-y-2 text-[13px] text-zinc-700">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Create Maps campaign
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Run baseline scans
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> Choose schedule
              </li>
              <li className="flex gap-2 text-zinc-500">
                <Check className="mt-0.5 h-4 w-4 text-zinc-300" /> Optionally run Growth Audit
              </li>
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={path === "prospect" ? "/prospects" : "/clients"}
              className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("running")}
            >
              Open {path === "prospect" ? "prospects" : "clients"} and start
            </Link>
            <Link href="/scans/new" className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
              New Maps scan
            </Link>
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("keywords")}
            >
              Back
            </button>
          </div>
        </div>
      ) : null}

      {step === "running" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">Scan runs in the background</h2>
          <p className="text-[13px] text-zinc-600">
            You can keep setting up the client or return to Workspace. Suggested next actions:
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/clients" className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
              Run Growth Audit
            </Link>
            <Link href="/branding" className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
              Set up branding
            </Link>
            <Link href="/workspace" className={cn(btnPrimary, "h-9 px-3 text-[13px]")}>
              Go to Workspace
            </Link>
            <button
              type="button"
              className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
              onClick={() => setStep("done")}
            >
              Finish
            </button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[14px] font-semibold text-zinc-900">You&apos;re ready</h2>
          <p className="text-[13px] text-zinc-600">
            Workspace shows what needs attention. Pick a client or prospect for their
            Dashboard and tools. Reports are where you deliver the value.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace" className={cn(btnPrimary, "h-9 px-3 text-[13px]")}>
              Open Workspace
            </Link>
            <Link href="/reports" className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
              Reports
            </Link>
            {path === "explore" ? (
              <button
                type="button"
                className={cn(btnSecondary, "h-9 px-3 text-[13px]")}
                onClick={() => setStep("welcome")}
              >
                Pick a path
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
