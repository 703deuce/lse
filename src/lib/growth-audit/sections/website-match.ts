import type { AuditCheck } from "@/lib/audit/types";
import type { WebsiteMatchSection } from "@/lib/growth-audit/types";

export function buildWebsiteSection(checks: AuditCheck[], score: number): WebsiteMatchSection {
  return { score, checks };
}
