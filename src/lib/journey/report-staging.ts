/**
 * Client-side staging basket for "Add to report" cross-tool actions.
 * Items are consumed by the reports hub / monthly wizard as suggested sections.
 */

export type StagedReportItem = {
  id: string;
  businessId: string;
  source:
    | "maps_scan"
    | "growth_audit"
    | "backlink_gap"
    | "local_trust"
    | "ai_visibility"
    | "reviews"
    | "keywords"
    | "campaign";
  title: string;
  href?: string;
  meta?: Record<string, string | number | boolean | null>;
  addedAt: string;
};

const STORAGE_KEY = "mrt:report-staging:v1";

function safeParse(raw: string | null): StagedReportItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StagedReportItem =>
        !!x &&
        typeof x === "object" &&
        typeof (x as StagedReportItem).id === "string" &&
        typeof (x as StagedReportItem).businessId === "string"
    );
  } catch {
    return [];
  }
}

export function listStagedReportItems(businessId?: string): StagedReportItem[] {
  if (typeof window === "undefined") return [];
  const all = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return businessId ? all.filter((i) => i.businessId === businessId) : all;
}

export function stageReportItem(
  item: Omit<StagedReportItem, "id" | "addedAt"> & { id?: string }
): StagedReportItem {
  const next: StagedReportItem = {
    ...item,
    id: item.id ?? `${item.source}:${item.businessId}:${Date.now()}`,
    addedAt: new Date().toISOString(),
  };
  if (typeof window === "undefined") return next;
  const existing = listStagedReportItems();
  const deduped = existing.filter(
    (e) => !(e.businessId === next.businessId && e.source === next.source && e.title === next.title)
  );
  deduped.unshift(next);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped.slice(0, 80)));
  window.dispatchEvent(new CustomEvent("mrt:report-staging-changed"));
  return next;
}

export function removeStagedReportItem(id: string): void {
  if (typeof window === "undefined") return;
  const next = listStagedReportItems().filter((i) => i.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("mrt:report-staging-changed"));
}

export function clearStagedReportItems(businessId: string): void {
  if (typeof window === "undefined") return;
  const next = listStagedReportItems().filter((i) => i.businessId !== businessId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("mrt:report-staging-changed"));
}

export function reportsHrefForStaging(
  businessId: string,
  opts?: { type?: string; source?: string }
): string {
  const params = new URLSearchParams();
  if (opts?.type) params.set("type", opts.type);
  if (opts?.source) params.set("staged", opts.source);
  params.set("from", "journey");
  const q = params.toString();
  return `/businesses/${businessId}/reports${q ? `?${q}` : ""}`;
}
