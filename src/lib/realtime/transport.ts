/**
 * Realtime transport abstraction.
 *
 * Preferred: Supabase Realtime (postgres_changes) when RLS-safe channels exist.
 * Alternative: authenticated SSE route handlers.
 * Fallback: adaptive polling via useActiveJobStatus.
 *
 * Always authenticate and authorize before opening a subscription — never trust
 * a browser-supplied organization ID alone.
 */

import type { RealtimeTransportName } from "@/lib/realtime/types";

export function resolveRealtimeTransport(): RealtimeTransportName {
  const raw = (process.env.REALTIME_TRANSPORT ?? "auto").trim().toLowerCase();
  if (raw === "sse" || raw === "polling" || raw === "supabase") return raw;
  // auto: prefer Supabase when URL configured, else polling
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return "supabase";
  return "polling";
}

/** Channel name helpers — server and client must use the same shapes. */
export function scanRealtimeChannel(scanId: string): string {
  return `scan:${scanId}`;
}

export function orgNotificationsChannel(organizationId: string): string {
  return `org:${organizationId}:notifications`;
}
