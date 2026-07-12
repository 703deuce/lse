import { domainFromUrl } from "@/lib/providers/dataforseo/match-target";

/** Normalize to lowercase root hostname without www. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes("/") || trimmed.startsWith("http")) {
    return domainFromUrl(trimmed);
  }
  return trimmed.replace(/^www\./, "").split("/")[0] || null;
}

export function domainsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeDomain(a);
  const nb = normalizeDomain(b);
  return !!na && !!nb && na === nb;
}
