import { customerSafeScanError } from "@/lib/scans/customer-safe-error";

const STRIP_CONFIDENCE_KEYS = new Set([
  "provider_error",
  "provider",
  "maps_provider_mode",
  "brightdata",
  "scrapingdog",
  "dataforseo",
  "api_key",
  "zone",
  "cookie",
  "recovery_stage",
  "internal_error",
  "dfs_sparse_serp_history",
  "dfs_execution_mode",
]);

/** Remove provider/credential internals from a scan batch before returning to the client. */
export function sanitizeScanBatchForClient<T extends Record<string, unknown>>(
  batch: T
): T {
  const next: Record<string, unknown> = { ...batch };
  if ("error_message" in next) {
    next.error_message = customerSafeScanError(
      next.error_message as string | null | undefined
    );
  }
  if ("provider" in next) {
    next.provider = "maps";
  }
  const conf = next.confidence_summary;
  if (conf && typeof conf === "object" && !Array.isArray(conf)) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(conf as Record<string, unknown>)) {
      if (STRIP_CONFIDENCE_KEYS.has(k)) continue;
      if (/bright|scrapingdog|dataforseo|api[_-]?key|cookie|zone/i.test(k)) continue;
      if (typeof v === "string" && /bright\s*data|scrapingdog|dataforseo|api[_-]?key/i.test(v)) {
        continue;
      }
      cleaned[k] = v;
    }
    next.confidence_summary = cleaned;
  }
  return next as T;
}
