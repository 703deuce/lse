import { createServiceClient } from "@/lib/db/client";
import {
  contactIdentity,
  normalizeContactPhone,
  normalizeEmail,
} from "@/lib/reputation/contacts-normalize";
import type { CanonicalWebhookPayload } from "@/lib/integrations/webhook-mapping";
import { enrollContactInCampaign } from "@/lib/automations/enroll-campaign";
import { contactDisplayName } from "@/lib/automations/contact-payload";
import { isEnrollEventType } from "@/lib/integrations/webhook-mapping";

export type ContactCandidate = {
  id: string;
  matchVia: string;
  customerName: string | null;
  email: string | null;
  phone: string | null;
  externalCustomerId: string | null;
};

export type ContactMatchEvaluation =
  | { kind: "clear"; preferredContactId: string | null }
  | { kind: "ambiguous"; reason: string; candidates: ContactCandidate[] };

type ContactRow = {
  id: string;
  customer_name: string | null;
  email_normalized: string | null;
  phone_e164: string | null;
  external_customer_id: string | null;
};

/**
 * Detect conflicting identity matches (external id vs phone/email pointing at different rows).
 */
export async function evaluateWebhookContactMatch(params: {
  businessId: string;
  externalId?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<ContactMatchEvaluation> {
  const supabase = createServiceClient();
  const { phoneE164, emailNormalized } = contactIdentity({
    phone: params.phone,
    email: params.email,
  });
  const externalId = params.externalId?.trim() || null;

  const byKey = new Map<string, ContactCandidate>();

  const add = (row: ContactRow | null, via: string) => {
    if (!row) return;
    const existing = byKey.get(row.id);
    if (existing) {
      existing.matchVia = `${existing.matchVia}+${via}`;
      return;
    }
    byKey.set(row.id, {
      id: row.id,
      matchVia: via,
      customerName: row.customer_name,
      email: row.email_normalized,
      phone: row.phone_e164,
      externalCustomerId: row.external_customer_id,
    });
  };

  if (externalId) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select("id, customer_name, email_normalized, phone_e164, external_customer_id")
      .eq("business_id", params.businessId)
      .eq("external_customer_id", externalId)
      .maybeSingle();
    add((data as ContactRow | null) ?? null, "external_id");
  }
  if (phoneE164) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select("id, customer_name, email_normalized, phone_e164, external_customer_id")
      .eq("business_id", params.businessId)
      .eq("phone_e164", phoneE164)
      .maybeSingle();
    add((data as ContactRow | null) ?? null, "phone");
  }
  if (emailNormalized) {
    const { data } = await supabase
      .from("review_request_contacts")
      .select("id, customer_name, email_normalized, phone_e164, external_customer_id")
      .eq("business_id", params.businessId)
      .eq("email_normalized", emailNormalized)
      .maybeSingle();
    add((data as ContactRow | null) ?? null, "email");
  }

  const candidates = [...byKey.values()];
  if (candidates.length <= 1) {
    return { kind: "clear", preferredContactId: candidates[0]?.id ?? null };
  }

  const vias = candidates.map((c) => c.matchVia).join(", ");
  return {
    kind: "ambiguous",
    reason: `Multiple contacts matched (${vias}). Review before sending a request.`,
    candidates,
  };
}

export async function createContactMatchReview(params: {
  organizationId: string;
  businessId: string;
  endpointId: string;
  eventId: string;
  reason: string;
  candidates: ContactCandidate[];
  normalized: CanonicalWebhookPayload;
}): Promise<string> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("integration_webhook_contact_matches")
    .upsert(
      {
        organization_id: params.organizationId,
        business_id: params.businessId,
        endpoint_id: params.endpointId,
        event_id: params.eventId,
        status: "pending",
        reason: params.reason,
        candidate_contact_ids: params.candidates,
        incoming_external_id: params.normalized.customer.external_id,
        incoming_email: normalizeEmail(params.normalized.customer.email),
        incoming_phone: normalizeContactPhone(params.normalized.customer.phone),
        incoming_name: params.normalized.customer.name,
        payload_normalized: params.normalized,
        updated_at: now,
      },
      { onConflict: "event_id" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listPendingContactMatches(params: {
  organizationId: string;
  businessId: string;
  limit?: number;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_webhook_contact_matches")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("business_id", params.businessId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(Math.min(params.limit ?? 50, 100));
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Resolve an ambiguous match: link to a contact (then enroll) or skip.
 */
export async function resolveContactMatch(params: {
  organizationId: string;
  businessId: string;
  matchId: string;
  action: "link" | "skip";
  contactId?: string | null;
  userId?: string | null;
}): Promise<{ ok: boolean; enrolled?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { data: match } = await supabase
    .from("integration_webhook_contact_matches")
    .select("*")
    .eq("id", params.matchId)
    .eq("organization_id", params.organizationId)
    .eq("business_id", params.businessId)
    .eq("status", "pending")
    .maybeSingle();
  if (!match) return { ok: false, error: "Match not found or already resolved" };

  const now = new Date().toISOString();

  if (params.action === "skip") {
    await supabase
      .from("integration_webhook_contact_matches")
      .update({
        status: "resolved_skip",
        resolved_by_user_id: params.userId ?? null,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", match.id);
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "ignored_duplicate",
        customer_safe_error: "Ambiguous contact match skipped by user",
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
    return { ok: true, enrolled: false };
  }

  if (!params.contactId) {
    return { ok: false, error: "contactId required to link" };
  }

  const { data: contact } = await supabase
    .from("review_request_contacts")
    .select("id")
    .eq("id", params.contactId)
    .eq("business_id", params.businessId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "Contact not found" };

  const normalized = match.payload_normalized as CanonicalWebhookPayload;
  const { data: endpoint } = await supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("id", match.endpoint_id)
    .maybeSingle();

  const { phoneE164, emailNormalized } = contactIdentity({
    phone: normalized.customer.phone,
    email: normalized.customer.email,
  });
  const display = contactDisplayName({
    firstName: normalized.customer.first_name,
    lastName: normalized.customer.last_name,
    name: normalized.customer.name,
    phone: normalized.customer.phone,
    email: normalized.customer.email,
  });

  // Only attach phone/email when not owned by a different contact (unique constraints).
  let phoneOk = phoneE164;
  let emailOk = emailNormalized;
  if (phoneE164) {
    const { data: phoneOwner } = await supabase
      .from("review_request_contacts")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("phone_e164", phoneE164)
      .neq("id", params.contactId)
      .maybeSingle();
    if (phoneOwner) phoneOk = null;
  }
  if (emailNormalized) {
    const { data: emailOwner } = await supabase
      .from("review_request_contacts")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("email_normalized", emailNormalized)
      .neq("id", params.contactId)
      .maybeSingle();
    if (emailOwner) emailOk = null;
  }

  const patch: Record<string, unknown> = {
    first_name: normalized.customer.first_name,
    last_name: normalized.customer.last_name,
    customer_name: display,
    external_customer_id: normalized.customer.external_id,
    last_service_date:
      normalized.transaction.completed_at ?? normalized.occurred_at ?? null,
    source: "webhook_match_resolve",
    updated_at: now,
  };
  if (phoneOk) {
    patch.phone_e164 = phoneOk;
    patch.customer_phone = phoneOk;
  }
  if (emailOk) {
    patch.email_normalized = emailOk;
    patch.customer_email = emailOk;
  }

  await supabase
    .from("review_request_contacts")
    .update(patch)
    .eq("id", params.contactId)
    .eq("business_id", params.businessId);

  const { data: linked } = await supabase
    .from("review_request_contacts")
    .select("id, first_name, last_name, customer_name, phone_e164, email_normalized, external_customer_id")
    .eq("id", params.contactId)
    .maybeSingle();

  let enrolled = false;
  const campaignId =
    endpoint?.campaign_id || endpoint?.default_campaign_id || null;

  if (
    endpoint &&
    !endpoint.is_test &&
    campaignId &&
    isEnrollEventType(normalized.event_type) &&
    linked &&
    (linked.phone_e164 || linked.email_normalized)
  ) {
    // Enroll using the linked contact's stored identity to avoid re-matching the other candidate.
    const result = await enrollContactInCampaign({
      organizationId: params.organizationId,
      businessId: params.businessId,
      campaignId: String(campaignId),
      contact: {
        firstName: linked.first_name,
        lastName: linked.last_name,
        name: linked.customer_name,
        phone: linked.phone_e164,
        email: linked.email_normalized,
        externalId: linked.external_customer_id,
        jobType: normalized.transaction.type,
        serviceDate: normalized.transaction.completed_at ?? normalized.occurred_at,
      },
      delayMinutes: Number(endpoint.send_delay_minutes ?? 0),
      duplicateProtectionDays: Number(endpoint.duplicate_window_days ?? 90),
    });
    enrolled = !result.skipped && !result.alreadyEnrolled;
    await supabase
      .from("integration_webhook_events")
      .update({
        status: result.skipped
          ? "ignored_suppressed"
          : result.alreadyEnrolled
            ? "ignored_duplicate"
            : "completed",
        contact_id: result.contactId || params.contactId,
        campaign_enrollment_id: result.recipientId || null,
        customer_safe_error: result.skipReason ?? "Linked after match review",
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
  } else {
    await supabase
      .from("integration_webhook_events")
      .update({
        status: endpoint?.is_test ? "ignored_test" : "completed",
        contact_id: params.contactId,
        customer_safe_error: endpoint?.is_test
          ? "Test mode after match resolve"
          : "Contact linked after match review",
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
  }

  await supabase
    .from("integration_webhook_contact_matches")
    .update({
      status: "resolved_link",
      resolution_contact_id: params.contactId,
      resolved_by_user_id: params.userId ?? null,
      resolved_at: now,
      updated_at: now,
    })
    .eq("id", match.id);

  return { ok: true, enrolled };
}
