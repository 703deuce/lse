export const dynamic = "force-dynamic";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SessionIdleTimeout } from "@/components/auth/session-idle-timeout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <SessionIdleTimeout />
      {children}
    </DashboardShell>
  );
}
