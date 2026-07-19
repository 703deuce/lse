import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { PageHeader } from "@/components/ui/page-header";
import { cardClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export default async function ProfileSettingsPage() {
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", auth.userId)
    .maybeSingle();

  return (
    <>
      <PageHeader title="Profile" subtitle="Your freelancer account details." />
      <div className={cn(cardClass, "max-w-lg p-5 text-sm")}>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Name</dt>
            <dd className="mt-1 text-zinc-900">
              {(profile?.full_name as string | null)?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</dt>
            <dd className="mt-1 text-zinc-900">
              {(profile?.email as string | null) || auth.email || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Role</dt>
            <dd className="mt-1 text-zinc-900">Owner</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-zinc-500">
          Invite assistants under{" "}
          <a href="/settings/team" className="font-medium text-[#137752] hover:underline">
            Settings → Team
          </a>
          . Owners manage billing, branding, and deletion.
        </p>
      </div>
    </>
  );
}
