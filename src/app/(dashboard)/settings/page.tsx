import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/page-header";
import { AccountPlanUsageCard } from "@/components/settings/account-plan-usage-card";

export default async function SettingsPage() {
  await requirePageAuth();

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account, subscription, branding, and security for your freelancer workspace."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsLink href="/settings/profile" title="Profile" body="Name and account email." />
        <SettingsLink
          href="/settings/subscription"
          title="Subscription"
          body="Plan limits and active location slots."
        />
        <SettingsLink href="/branding" title="Branding" body="White-label report identity." />
        <SettingsLink href="/settings/security" title="Security" body="Password and session security." />
        <SettingsLink href="/onboarding" title="Get started" body="Freelancer onboarding checklist." />
      </div>
      <AccountPlanUsageCard />
    </>
  );
}

function SettingsLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:bg-zinc-50/40"
    >
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{body}</p>
    </Link>
  );
}
