import { createServiceClient } from "@/lib/db/client";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import {
  getSigningSecrets,
  resolveEndpointByToken,
  type WebhookEndpointRow,
} from "@/lib/integrations/webhook-endpoints";
import {
  hashIp,
  hashPayload,
  verifyWebhookSignature,
} from "@/lib/integrations/webhook-crypto";
import {
  applyFieldMapping,
  isEnrollEventType,
} from "@/lib/integrations/webhook-mapping";
import { logger } from "@/lib/observability/logger";
import { randomBytes } from "crypto";

const MAX_BODY_BYTES = Number(process.env.WEBHOOK_MAX_BODY_BYTES ?? 128 * 1024);

export type IngestHttpResult = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

function opaqueUnauthorized(): IngestHttpResult {
  return {
    status: 401,
    body: { accepted: false, error: "Unauthorized" },
  };
}

async function checkRateLimit(endpoint: WebhookEndpointRow): Promise<boolean> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("integration_webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("endpoint_id", endpoint.id)
    .gte("received_at", since);
  return (count ?? 0) < Math.max(1, endpoint.rate_limit_per_minute);
}

function redactPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  const scrub = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (/secret|password|token|authorization/i.test(k)) {
        obj[k] = "[redacted]";
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        scrub(v as Record<string, unknown>);
      }
    }
  };
  scrub(clone);
  return clone;
}

/**
 * Fast-path HTTP ingest: authenticate, ledger, enqueue. Never sends messages.
 */
export async function ingestIncomingWebhook(params: {
  endpointToken: string;
  rawBody: string;
  contentType: string | null;
  headers: Headers;
  sourceIp?: string | null;
}): Promise<IngestHttpResult> {
  const requestId = `req_${randomBytes(8).toString("hex")}`;

  if ((params.contentType || "").toLowerCase().indexOf("application/json") === -1) {
    return { status: 415, body: { accepted: false, error: "Unsupported Media Type", request_id: requestId } };
  }
  if (Buffer.byteLength(params.rawBody, "utf8") > MAX_BODY_BYTES) {
    return { status: 413, body: { accepted: false, error: "Payload Too Large", request_id: requestId } };
  }

  const endpoint = await resolveEndpointByToken(params.endpointToken);
  if (!endpoint) return opaqueUnauthorized();

  if (!endpoint.is_active || endpoint.revoked_at) {
    return {
      status: 403,
      body: { accepted: false, error: "Endpoint disabled", request_id: requestId },
    };
  }

  if (endpoint.ip_allowlist.length) {
    const ip = params.sourceIp?.trim();
    if (!ip || !endpoint.ip_allowlist.includes(ip)) {
      return opaqueUnauthorized();
    }
  }

  if (!(await checkRateLimit(endpoint))) {
    return {
      status: 429,
      body: { accepted: false, error: "Too Many Requests", request_id: requestId },
      headers: { "Retry-After": "60" },
    };
  }

  if (endpoint.signature_required) {
    const ts = params.headers.get("x-lse-timestamp") ?? "";
    const sig = params.headers.get("x-lse-signature") ?? "";
    const secrets = getSigningSecrets(endpoint);
    if (
      !secrets.length ||
      !verifyWebhookSignature({
        secrets,
        timestamp: ts,
        rawBody: params.rawBody,
        signatureHeader: sig,
      })
    ) {
      logger.warn("webhook_signature_failed", {
        endpointId: endpoint.id,
        organizationId: endpoint.organization_id,
        requestId,
      });
      return opaqueUnauthorized();
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(params.rawBody) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
  } catch {
    return {
      status: 400,
      body: { accepted: false, error: "Invalid JSON", request_id: requestId },
    };
  }

  // Never trust tenant fields from payload.
  delete parsed.organizationId;
  delete parsed.organization_id;
  delete parsed.businessId;
  delete parsed.business_id;

  const normalized = applyFieldMapping(parsed, endpoint.field_mapping, {
    eventType: endpoint.default_event_type,
  });

  const headerEventId = params.headers.get("x-lse-event-id")?.trim() || null;
  const headerEventType = params.headers.get("x-lse-event-type")?.trim() || null;
  if (headerEventType) normalized.event_type = headerEventType;
  if (headerEventId) normalized.event_id = headerEventId;

  if (!endpoint.allowed_event_types.includes(normalized.event_type)) {
    return {
      status: 403,
      body: {
        accepted: false,
        error: "Event type not permitted for this endpoint",
        request_id: requestId,
      },
    };
  }

  if (!normalized.customer.email && !normalized.customer.phone) {
    return {
      status: 400,
      body: {
        accepted: false,
        error: "customer.email or customer.phone is required",
        request_id: requestId,
      },
    };
  }

  if (!normalized.event_id) {
    // Derive a stable-ish event id when missing (still dedupe by payload hash).
    normalized.event_id = `auto_${hashPayload(params.rawBody).slice(0, 24)}`;
  }

  if (!isEnrollEventType(normalized.event_type) && normalized.event_type !== "custom") {
    // Still accept customer.created for upsert-only later; for now queue all.
  }

  const payloadHash = hashPayload(params.rawBody);
  const idempotencyKey = `${normalized.event_type}:${normalized.event_id}`;
  const businessId =
    endpoint.business_id ?? endpoint.default_business_id ?? null;
  const campaignId =
    endpoint.campaign_id ?? endpoint.default_campaign_id ?? null;

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const eventInsert = {
    endpoint_id: endpoint.id,
    organization_id: endpoint.organization_id,
    business_id: businessId,
    campaign_id: campaignId,
    external_event_id: normalized.event_id,
    event_type: normalized.event_type,
    idempotency_key: idempotencyKey,
    request_id: requestId,
    payload_hash: payloadHash,
    payload_redacted: redactPayload(parsed),
    payload_normalized: normalized,
    received_headers_redacted: {
      "content-type": params.contentType,
      "x-lse-event-id": headerEventId,
      "x-lse-event-type": headerEventType,
      "user-agent": params.headers.get("user-agent")?.slice(0, 200) ?? null,
    },
    source_ip_hash: params.sourceIp ? hashIp(params.sourceIp) : null,
    status: "queued",
    received_at: now,
    updated_at: now,
  };

  const { data: eventRow, error: insertErr } = await supabase
    .from("integration_webhook_events")
    .insert(eventInsert)
    .select("id, status")
    .maybeSingle();

  if (insertErr) {
    // Unique violation → already processed/received
    if (/duplicate|unique|23505/i.test(insertErr.message)) {
      return {
        status: 200,
        body: {
          accepted: true,
          duplicate: true,
          status: "already_received",
          event_id: normalized.event_id,
          request_id: requestId,
        },
      };
    }
    logger.error("webhook_event_insert_failed", {
      error: insertErr.message,
      endpointId: endpoint.id,
      requestId,
    });
    return {
      status: 503,
      body: { accepted: false, error: "Temporarily unavailable", request_id: requestId },
    };
  }

  await supabase
    .from("integration_webhook_endpoints")
    .update({ last_received_at: now, updated_at: now })
    .eq("id", endpoint.id);

  try {
    const job = await dispatchFeatureJob({
      jobType: "integration_webhook_process",
      organizationId: endpoint.organization_id,
      businessId,
      relatedResourceId: eventRow!.id as string,
      idempotencyKey: `webhook_event:${eventRow!.id}`,
      payload: {
        eventId: eventRow!.id,
        endpointId: endpoint.id,
      },
      maxAttempts: 5,
      kickImmediately: true,
    });

    await supabase
      .from("integration_webhook_events")
      .update({
        processing_job_id: job.jobId,
        status: "queued",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventRow!.id);

    return {
      status: 202,
      body: {
        accepted: true,
        event_id: normalized.event_id,
        request_id: requestId,
        status: "queued",
      },
    };
  } catch (err) {
    await supabase
      .from("integration_webhook_events")
      .update({
        status: "failed_retryable",
        customer_safe_error: "Queued for retry",
        internal_error: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventRow!.id);
    logger.error("webhook_enqueue_failed", {
      eventId: eventRow!.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Still 202 — durable ledger row exists; recovery can pick it up.
    return {
      status: 202,
      body: {
        accepted: true,
        event_id: normalized.event_id,
        request_id: requestId,
        status: "queued",
      },
    };
  }
}
