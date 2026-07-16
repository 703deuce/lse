import { createServiceClient } from "@/lib/db/client";
import { enrollContactInCampaign } from "@/lib/automations/enroll-campaign";
import { upsertBusinessContact } from "@/lib/reputation/contacts";
import { contactDisplayName } from "@/lib/automations/contact-payload";
import type { CanonicalWebhookPayload } from "@/lib/integrations/webhook-mapping";
import { isEnrollEventType } from "@/lib/integrations/webhook-mapping";
import {
  createContactMatchReview,
  evaluateWebhookContactMatch,
} from "@/lib/integrations/webhook-contact-match";
import { mapEnrollmentSkipStatus } from "@/lib/integrations/webhook-status";
import { logger } from "@/lib/observability/logger";

type ProcessResult = {
  ok: boolean;
  permanent?: boolean;
  error?: string;
};

const TERMINAL = new Set([
  "completed",
  "ignored_duplicate",
  "ignored_suppressed",
  "ignored_recently_requested",
  "ignored_test",
  "rejected_invalid",
  "rejected_unauthorized",
  "failed_permanent",
  "needs_review",
]);

const STALE_PROCESSING_MS = Number(process.env.WEBHOOK_STALE_PROCESSING_MS ?? 5 * 60 * 1000);

function isPermanentBusinessError(message: string): boolean {
  return (
    /Campaign must be active or scheduled/i.test(message) ||
    /Generate a review link/i.test(message) ||
    /Business not found/i.test(message) ||
    /Campaign not found/i.test(message) ||
    /Contact requires a valid phone or email/i.test(message) ||
    /No business configured/i.test(message) ||
    /Endpoint disabled/i.test(message) ||
    /consent required/i.test(message)
  );
}

async function claimEvent(eventId: string): Promise<Record<string, unknown> | null> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("integration_webhook_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!existing) return null;

  if (TERMINAL.has(String(existing.status))) {
    return { ...existing, __alreadyDone: true };
  }

  const now = new Date().toISOString();
  const status = String(existing.status);

  // Reclaim stale processing (worker died mid-flight).
  if (status === "processing") {
    const updatedAt = new Date(String(existing.updated_at ?? existing.received_at)).getTime();
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt < STALE_PROCESSING_MS) {
      return { __busy: true };
    }
    const { data } = await supabase
      .from("integration_webhook_events")
      .update({
        status: "processing",
        attempt_count: Number(existing.attempt_count ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", eventId)
      .eq("status", "processing")
      .lt("updated_at", new Date(Date.now() - STALE_PROCESSING_MS).toISOString())
      .select("*")
      .maybeSingle();
    return (data as Record<string, unknown> | null) ?? { __busy: true };
  }

  const { data } = await supabase
    .from("integration_webhook_events")
    .update({
      status: "processing",
      attempt_count: Number(existing.attempt_count ?? 0) + 1,
      updated_at: now,
    })
    .eq("id", eventId)
    .in("status", ["queued", "failed_retryable", "received", "validated"])
    .select("*")
    .maybeSingle();

  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Worker: enroll contact into campaign via existing campaign pipeline.
 * Never sends SMS/email itself.
 */
export async function processIntegrationWebhookEvent(eventId: string): Promise<ProcessResult> {
  const supabase = createServiceClient();
  const claimed = await claimEvent(eventId);
  if (!claimed) {
    return { ok: false, error: "Failed to claim webhook event" };
  }
  if (claimed.__alreadyDone) {
    return { ok: true };
  }
  if (claimed.__busy) {
    // Another worker holds a fresh processing lock — retry later.
    return { ok: false, error: "Webhook event still processing" };
  }

  const endpointId = claimed.endpoint_id as string;
  const { data: endpoint } = await supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("id", endpointId)
    .maybeSingle();

  if (!endpoint || endpoint.revoked_at || !endpoint.is_active) {
    await finish(eventId, {
      status: "rejected_unauthorized",
      customer_safe_error: "Endpoint disabled",
      permanent: true,
    });
    return { ok: false, permanent: true, error: "Endpoint disabled" };
  }

  const normalized = claimed.payload_normalized as CanonicalWebhookPayload;
  const organizationId = claimed.organization_id as string;
  const businessId =
    (claimed.business_id as string | null) ||
    (endpoint.business_id as string | null) ||
    (endpoint.default_business_id as string | null);
  const campaignId =
    (claimed.campaign_id as string | null) ||
    (endpoint.campaign_id as string | null) ||
    (endpoint.default_campaign_id as string | null);

  if (!businessId) {
    await finish(eventId, {
      status: "failed_permanent",
      customer_safe_error: "No business configured on endpoint",
      permanent: true,
    });
    return { ok: false, permanent: true, error: "Missing business" };
  }

  if (endpoint.require_email_consent && normalized.consent?.email !== true) {
    await finish(eventId, {
      status: "rejected_invalid",
      customer_safe_error: "Email consent required",
      permanent: true,
    });
    await touchEndpoint(endpointId, "failure");
    return { ok: false, permanent: true, error: "Email consent required" };
  }
  if (endpoint.require_sms_consent && normalized.consent?.sms !== true) {
    await finish(eventId, {
      status: "rejected_invalid",
      customer_safe_error: "SMS consent required",
      permanent: true,
    });
    await touchEndpoint(endpointId, "failure");
    return { ok: false, permanent: true, error: "SMS consent required" };
  }

  const contactInput = {
    firstName: normalized.customer.first_name,
    lastName: normalized.customer.last_name,
    name: normalized.customer.name,
    phone: normalized.customer.phone,
    email: normalized.customer.email,
    externalId: normalized.customer.external_id,
    jobType: normalized.transaction.type,
    serviceDate: normalized.transaction.completed_at ?? normalized.occurred_at,
    tags: Array.isArray(endpoint.tags) ? (endpoint.tags as string[]) : [],
  };

  try {
    const match = await evaluateWebhookContactMatch({
      businessId,
      externalId: contactInput.externalId,
      phone: contactInput.phone,
      email: contactInput.email,
    });

    if (match.kind === "ambiguous") {
      await createContactMatchReview({
        organizationId,
        businessId,
        endpointId,
        eventId,
        reason: match.reason,
        candidates: match.candidates,
        normalized,
      });
      await finish(eventId, {
        status: "needs_review",
        customer_safe_error: match.reason,
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }

    const contactMode = String(endpoint.contact_update_mode ?? "upsert");
    const existingContactId = match.preferredContactId;

    if (contactMode === "create_only" && existingContactId) {
      await finish(eventId, {
        status: "ignored_duplicate",
        contact_id: existingContactId,
        customer_safe_error: "Contact already exists (create_only mode)",
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }
    if (contactMode === "update_only" && !existingContactId) {
      await finish(eventId, {
        status: "rejected_invalid",
        customer_safe_error: "No existing contact to update (update_only mode)",
        permanent: true,
      });
      await touchEndpoint(endpointId, "failure");
      return { ok: false, permanent: true, error: "update_only miss" };
    }
    if (contactMode === "skip_existing" && existingContactId) {
      await finish(eventId, {
        status: "ignored_duplicate",
        contact_id: existingContactId,
        customer_safe_error: "Existing contact skipped (skip_existing mode)",
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }

    // Test mode: upsert contact optionally skipped — evaluate only, no enrollment messages.
    if (endpoint.is_test) {
      const { id: contactId, created } = await upsertBusinessContact({
        organizationId,
        businessId,
        preferredContactId: existingContactId,
        firstName: contactInput.firstName,
        lastName: contactInput.lastName,
        customerName: contactDisplayName(contactInput),
        phone: contactInput.phone,
        email: contactInput.email,
        externalCustomerId: contactInput.externalId,
        lastServiceDate: contactInput.serviceDate ?? undefined,
        tags: contactInput.tags,
        source: "webhook_test",
      });

      await finish(eventId, {
        status: "ignored_test",
        contact_id: contactId,
        customer_safe_error: created
          ? "Test mode: contact created, no campaign enrollment"
          : "Test mode: contact matched, no campaign enrollment",
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }

    if (!campaignId || !isEnrollEventType(normalized.event_type)) {
      const { id: contactId } = await upsertBusinessContact({
        organizationId,
        businessId,
        preferredContactId: existingContactId,
        firstName: contactInput.firstName,
        lastName: contactInput.lastName,
        customerName: contactDisplayName(contactInput),
        phone: contactInput.phone,
        email: contactInput.email,
        externalCustomerId: contactInput.externalId,
        lastServiceDate: contactInput.serviceDate ?? undefined,
        tags: contactInput.tags,
        source: "webhook",
      });
      await finish(eventId, {
        status: "completed",
        contact_id: contactId,
        customer_safe_error: campaignId ? undefined : "Contact upserted (no campaign on endpoint)",
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }

    const result = await enrollContactInCampaign({
      organizationId,
      businessId,
      campaignId,
      contact: contactInput,
      preferredContactId: existingContactId,
      delayMinutes: Number(endpoint.send_delay_minutes ?? 0),
      duplicateProtectionDays: Number(endpoint.duplicate_window_days ?? 90),
      enrollmentSource: "webhook",
      sourceEventId: eventId,
      occurredAt: (claimed.occurred_at as string | null) ?? (claimed.created_at as string | null),
    });

    if (result.skipped) {
      await finish(eventId, {
        status: mapEnrollmentSkipStatus(result.skipReason),
        contact_id: result.contactId || null,
        campaign_enrollment_id: result.recipientId || null,
        customer_safe_error: result.skipReason ?? "Skipped",
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }

    if (result.alreadyEnrolled) {
      await finish(eventId, {
        status: "ignored_duplicate",
        contact_id: result.contactId,
        campaign_enrollment_id: result.recipientId,
        customer_safe_error: "Already enrolled in campaign",
      });
      await touchEndpoint(endpointId, "success");
      return { ok: true };
    }

    await finish(eventId, {
      status: "completed",
      contact_id: result.contactId,
      campaign_enrollment_id: result.recipientId,
    });
    await touchEndpoint(endpointId, "success");
    logger.info("webhook_enrollment_completed", {
      eventId,
      endpointId,
      organizationId,
      businessId,
      campaignId,
      recipientId: result.recipientId,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = isPermanentBusinessError(message);
    await finish(eventId, {
      status: permanent ? "failed_permanent" : "failed_retryable",
      customer_safe_error: permanent ? message : "Processing failed; will retry",
      internal_error: message,
    });
    await touchEndpoint(endpointId, "failure");
    return { ok: false, permanent, error: message };
  }
}

async function finish(
  eventId: string,
  patch: {
    status: string;
    contact_id?: string | null;
    campaign_enrollment_id?: string | null;
    customer_safe_error?: string;
    internal_error?: string;
    permanent?: boolean;
  }
) {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = {
    status: patch.status,
    customer_safe_error: patch.customer_safe_error ?? null,
    internal_error: patch.internal_error ?? null,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (patch.contact_id) update.contact_id = patch.contact_id;
  if (patch.campaign_enrollment_id) update.campaign_enrollment_id = patch.campaign_enrollment_id;
  await supabase.from("integration_webhook_events").update(update).eq("id", eventId);
}

async function touchEndpoint(endpointId: string, kind: "success" | "failure") {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  await supabase
    .from("integration_webhook_endpoints")
    .update(
      kind === "success"
        ? { last_success_at: now, updated_at: now }
        : { last_failure_at: now, updated_at: now }
    )
    .eq("id", endpointId);
}
