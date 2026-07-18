"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Target } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Path = "prospect" | "client" | null;

export default function OnboardingPage() {
  const [path, setPath] = useState<Path>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Welcome to Maps Rank Tracker"
        subtitle="Unlimited Google Maps rank tracking and client reporting for freelance local SEO."
      />

      {!path ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPath("prospect")}
            className="rounded-xl border border-zinc-200 bg-white p-5 text-left hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <Target className="h-6 w-6 text-amber-600" />
            <p className="mt-3 text-base font-semibold text-zinc-900">
              I want to audit a prospect
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Run a Maps scan and share a branded audit to win the client.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setPath("client")}
            className="rounded-xl border border-zinc-200 bg-white p-5 text-left hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <Building2 className="h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-base font-semibold text-zinc-900">
              I want to track an existing client
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Organize locations, keywords, scans, and monthly reports.
            </p>
          </button>
        </div>
      ) : (
        <ol className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 text-sm">
          <Step n={1} title="Add your branding" href="/branding">
            Logo and contact details so reports look like yours.
          </Step>
          <Step
            n={2}
            title={path === "prospect" ? "Create a prospect" : "Add a client"}
            href={path === "prospect" ? "/businesses/new?as=prospect" : "/businesses/new?as=client"}
          >
            Find their Google listing and save the location.
          </Step>
          <Step n={3} title="Add a keyword" href={path === "prospect" ? "/prospects" : "/clients"}>
            Open the location and add the first keyword to track.
          </Step>
          <Step n={4} title="Run your first scan" href={path === "prospect" ? "/prospects" : "/clients"}>
            Queue a Maps grid — it continues in the background.
          </Step>
          <Step n={5} title="Create or preview a report" href={path === "prospect" ? "/prospects" : "/clients"}>
            Turn completed scans into a branded shareable report.
          </Step>
          <li className="pt-2">
            <button
              type="button"
              onClick={() => setPath(null)}
              className="text-xs text-zinc-500 hover:underline"
            >
              Choose a different path
            </button>
          </li>
        </ol>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  href,
  children,
}: {
  n: number;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        {n}
      </span>
      <div>
        <Link href={href} className="font-semibold text-zinc-900 hover:text-emerald-700">
          {title}
        </Link>
        <p className="text-zinc-600">{children}</p>
      </div>
    </li>
  );
}
