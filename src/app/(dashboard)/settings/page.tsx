import Link from "next/link";
import { requirePageAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/page-header";
import { cardClass } from "@/components/ui/design-system";
import { AccountPlanUsageCard } from "@/components/settings/account-plan-usage-card";
import { cn } from "@/lib/utils";

export default async function SettingsPage() {
  await requirePageAuth();

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account, subscription, branding, and security for your independent consultant workspace."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsLink href="/settings/profile" title="Profile" body="Name and account email." />
        <SettingsLink
          href="/settings/team"
          title="Team"
          body="Invite Owner / Assistant seats for your workspace."
        />
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
      className={cn(cardClass, "p-4 transition hover:border-zinc-300 hover:bg-zinc-50/40")}
    >
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{body}</p>
    </Link>
  );
}
