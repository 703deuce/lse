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
import { mapEnrollmentSkipStatus } from "@/lib/integrations/webhook-status";

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
  const now = new Date().toISOString();

  // Atomic claim — only one resolver wins.
  const { data: match } = await supabase
    .from("integration_webhook_contact_matches")
    .update({
      status: params.action === "skip" ? "resolved_skip" : "resolved_link",
      resolved_by_user_id: params.userId ?? null,
      resolved_at: now,
      updated_at: now,
      ...(params.action === "link" && params.contactId
        ? { resolution_contact_id: params.contactId }
        : {}),
    })
    .eq("id", params.matchId)
    .eq("organization_id", params.organizationId)
    .eq("business_id", params.businessId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!match) return { ok: false, error: "Match not found or already resolved" };

  if (params.action === "skip") {
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
    // Roll claim back to pending if link lacked contactId.
    await supabase
      .from("integration_webhook_contact_matches")
      .update({
        status: "pending",
        resolution_contact_id: null,
        resolved_by_user_id: null,
        resolved_at: null,
        updated_at: now,
      })
      .eq("id", match.id);
    return { ok: false, error: "contactId required to link" };
  }

  const candidates = Array.isArray(match.candidate_contact_ids)
    ? (match.candidate_contact_ids as Array<{ id?: string }>)
    : [];
  const allowedIds = new Set(
    candidates.map((c) => c.id).filter((id): id is string => Boolean(id))
  );
  if (allowedIds.size && !allowedIds.has(params.contactId)) {
    await supabase
      .from("integration_webhook_contact_matches")
      .update({
        status: "pending",
        resolution_contact_id: null,
        resolved_by_user_id: null,
        resolved_at: null,
        updated_at: now,
      })
      .eq("id", match.id);
    return { ok: false, error: "Contact is not a match candidate" };
  }

  const { data: contact } = await supabase
    .from("review_request_contacts")
    .select("id")
    .eq("id", params.contactId)
    .eq("business_id", params.businessId)
    .maybeSingle();
  if (!contact) {
    await supabase
      .from("integration_webhook_contact_matches")
      .update({
        status: "pending",
        resolution_contact_id: null,
        resolved_by_user_id: null,
        resolved_at: null,
        updated_at: now,
      })
      .eq("id", match.id);
    return { ok: false, error: "Contact not found" };
  }

  const normalized = match.payload_normalized as CanonicalWebhookPayload;
  const { data: endpoint } = await supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("id", match.endpoint_id)
    .maybeSingle();

  async function rollbackMatch(error: string) {
    await supabase
      .from("integration_webhook_contact_matches")
      .update({
        status: "pending",
        resolution_contact_id: null,
        resolved_by_user_id: null,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);
    return { ok: false as const, error };
  }

  if (!endpoint || endpoint.revoked_at || !endpoint.is_active) {
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "rejected_unauthorized",
        customer_safe_error: "Endpoint disabled",
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
    return { ok: true, enrolled: false };
  }

  if (endpoint.require_email_consent && normalized.consent?.email !== true) {
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "rejected_invalid",
        customer_safe_error: "Email consent required",
        contact_id: params.contactId,
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
    return { ok: true, enrolled: false };
  }
  if (endpoint.require_sms_consent && normalized.consent?.sms !== true) {
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "rejected_invalid",
        customer_safe_error: "SMS consent required",
        contact_id: params.contactId,
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
    return { ok: true, enrolled: false };
  }

  const contactMode = String(endpoint.contact_update_mode ?? "upsert");
  if (contactMode === "create_only" || contactMode === "skip_existing") {
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "ignored_duplicate",
        contact_id: params.contactId,
        customer_safe_error: `Contact already exists (${contactMode} mode)`,
        processed_at: now,
        updated_at: now,
      })
      .eq("id", match.event_id);
    return { ok: true, enrolled: false };
  }

  try {
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

    let externalOk = normalized.customer.external_id?.trim() || null;
    if (externalOk) {
      const { data: extOwner } = await supabase
        .from("review_request_contacts")
        .select("id")
        .eq("business_id", params.businessId)
        .eq("external_customer_id", externalOk)
        .neq("id", params.contactId)
        .maybeSingle();
      if (extOwner) externalOk = null;
    }

    const patch: Record<string, unknown> = {
      first_name: normalized.customer.first_name,
      last_name: normalized.customer.last_name,
      customer_name: display,
      last_service_date:
        normalized.transaction.completed_at ?? normalized.occurred_at ?? null,
      source: "webhook_match_resolve",
      updated_at: now,
    };
    if (externalOk) patch.external_customer_id = externalOk;
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
      .select(
        "id, first_name, last_name, customer_name, phone_e164, email_normalized, external_customer_id"
      )
      .eq("id", params.contactId)
      .maybeSingle();

    let enrolled = false;
    const campaignId =
      endpoint.campaign_id || endpoint.default_campaign_id || null;

    if (
      !endpoint.is_test &&
      campaignId &&
      isEnrollEventType(normalized.event_type) &&
      linked &&
      (linked.phone_e164 || linked.email_normalized)
    ) {
      const result = await enrollContactInCampaign({
        organizationId: params.organizationId,
        businessId: params.businessId,
        campaignId: String(campaignId),
        preferredContactId: params.contactId,
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
        enrollmentSource: "webhook",
        sourceEventId: String(match.event_id),
        occurredAt: normalized.occurred_at ?? null,
      });
      enrolled = !result.skipped && !result.alreadyEnrolled;
      await supabase
        .from("integration_webhook_events")
        .update({
          status: result.skipped
            ? mapEnrollmentSkipStatus(result.skipReason)
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
          status: endpoint.is_test ? "ignored_test" : "completed",
          contact_id: params.contactId,
          customer_safe_error: endpoint.is_test
            ? "Test mode after match resolve"
            : "Contact linked after match review",
          processed_at: now,
          updated_at: now,
        })
        .eq("id", match.event_id);
    }

    return { ok: true, enrolled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "failed_retryable",
        customer_safe_error: "Match resolve failed; will retry",
        internal_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.event_id);
    return rollbackMatch(message);
  }
}
