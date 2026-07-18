import { createServiceClient } from "@/lib/db/client";

export type NotificationEventType =
  | "scan_completed"
  | "scan_recovering_long"
  | "scheduled_scan_failed"
  | "report_viewed"
  | "upcoming_scheduled_scan";

export async function createAppNotification(input: {
  organizationId: string;
  userId?: string | null;
  eventType: NotificationEventType;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("app_notifications").insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      event_type: input.eventType,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    // non-blocking
  }
}
