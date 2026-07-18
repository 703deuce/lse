import { requirePageAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/page-header";
import { TeamInviteCard } from "@/components/settings/team-invite-card";

export default async function TeamSettingsPage() {
  await requirePageAuth();

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Invite an assistant to help run scans and deliver client reports."
      />
      <TeamInviteCard />
    </>
  );
}
