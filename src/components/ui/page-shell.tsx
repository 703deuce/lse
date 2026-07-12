import { cn } from "@/lib/utils";

/** Optional inner wrapper — sidebar and padding live in (dashboard)/layout.tsx. */
export function DashboardPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  /** @deprecated businessId is read from the route by the shared layout */
  businessId?: string;
}) {
  return <div className={cn(className)}>{children}</div>;
}
