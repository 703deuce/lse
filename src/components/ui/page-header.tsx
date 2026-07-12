import { ModuleHeader } from "@/components/ui/design-system";

/** @deprecated Use ModuleHeader from design-system — kept for page-level imports */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <ModuleHeader
      title={title}
      subtitle={subtitle}
      actions={actions}
      className={className}
    />
  );
}
