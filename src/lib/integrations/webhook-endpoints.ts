import { createServiceClient } from "@/lib/db/client";
import { appUrl } from "@/lib/app-url";
import {
  decryptSecret,
  encryptSecret,
  generateEndpointToken,
  generateSigningSecret,
  hashToken,
  safeEqualHex,
} from "@/lib/integrations/webhook-crypto";
import type { FieldMapping } from "@/lib/integrations/webhook-mapping";

export type WebhookEndpointRow = {
  id: string;
  organization_id: string;
  business_id: string | null;
  campaign_id: string | null;
  name: string;
  description: string | null;
  endpoint_token_hash: string;
  endpoint_token_last_four: string;
  previous_endpoint_token_hash: string | null;
  previous_token_expires_at: string | null;
  signing_secret_encrypted: string | null;
  previous_signing_secret_encrypted: string | null;
  previous_signing_secret_expires_at: string | null;
  signature_required: boolean;
  allowed_event_types: string[];
  default_event_type: string;
  default_campaign_id: string | null;
  default_business_id: string | null;
  contact_update_mode: string;
  duplicate_window_days: number;
  send_delay_minutes: number;
  timezone: string;
  field_mapping: FieldMapping;
  require_email_consent: boolean;
  require_sms_consent: boolean;
  ip_allowlist: string[];
  tags: string[];
  is_test: boolean;
  is_active: boolean;
  rate_limit_per_minute: number;
  last_received_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

function normalizeTypes(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function mapRow(row: Record<string, unknown>): WebhookEndpointRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    business_id: (row.business_id as string | null) ?? null,
    campaign_id: (row.campaign_id as string | null) ?? null,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    endpoint_token_hash: row.endpoint_token_hash as string,
    endpoint_token_last_four: row.endpoint_token_last_four as string,
    previous_endpoint_token_hash: (row.previous_endpoint_token_hash as string | null) ?? null,
    previous_token_expires_at: (row.previous_token_expires_at as string | null) ?? null,
    signing_secret_encrypted: (row.signing_secret_encrypted as string | null) ?? null,
    previous_signing_secret_encrypted:
      (row.previous_signing_secret_encrypted as string | null) ?? null,
    previous_signing_secret_expires_at:
      (row.previous_signing_secret_expires_at as string | null) ?? null,
    signature_required: Boolean(row.signature_required),
    allowed_event_types: normalizeTypes(row.allowed_event_types),
    default_event_type: String(row.default_event_type ?? "service.completed"),
    default_campaign_id: (row.default_campaign_id as string | null) ?? null,
    default_business_id: (row.default_business_id as string | null) ?? null,
    contact_update_mode: String(row.contact_update_mode ?? "upsert"),
    duplicate_window_days: Number(row.duplicate_window_days ?? 90),
    send_delay_minutes: Number(row.send_delay_minutes ?? 0),
    timezone: String(row.timezone ?? "America/New_York"),
    field_mapping: (row.field_mapping as FieldMapping) ?? {},
    require_email_consent: Boolean(row.require_email_consent),
    require_sms_consent: Boolean(row.require_sms_consent),
    ip_allowlist: normalizeTypes(row.ip_allowlist),
    tags: normalizeTypes(row.tags),
    is_test: Boolean(row.is_test),
    is_active: Boolean(row.is_active),
    rate_limit_per_minute: Number(row.rate_limit_per_minute ?? 60),
    last_received_at: (row.last_received_at as string | null) ?? null,
    last_success_at: (row.last_success_at as string | null) ?? null,
    last_failure_at: (row.last_failure_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    revoked_at: (row.revoked_at as string | null) ?? null,
  };
}

export function buildIncomingWebhookUrl(rawToken: string): string {
  return appUrl(`/api/integrations/webhooks/incoming/${encodeURIComponent(rawToken)}`);
}

export async function createWebhookEndpoint(input: {
  organizationId: string;
  businessId: string;
  campaignId: string;
  name: string;
  description?: string | null;
  eventType?: string;
  isTest?: boolean;
  signatureRequired?: boolean;
  sendDelayMinutes?: number;
  duplicateWindowDays?: number;
  fieldMapping?: FieldMapping;
  createdByUserId?: string | null;
}): Promise<{ endpoint: WebhookEndpointRow; rawToken: string; signingSecret: string | null }> {
  const supabase = createServiceClient();
  const token = generateEndpointToken();
  const signingSecret = input.signatureRequired ? generateSigningSecret() : null;

  const { data, error } = await supabase
    .from("integration_webhook_endpoints")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      campaign_id: input.campaignId,
      default_business_id: input.businessId,
      default_campaign_id: input.campaignId,
      name: input.name.trim() || "Automatic Review Trigger",
      description: input.description ?? null,
      endpoint_token_hash: token.hash,
      endpoint_token_last_four: token.lastFour,
      signing_secret_encrypted: signingSecret ? encryptSecret(signingSecret) : null,
      signature_required: Boolean(input.signatureRequired),
      default_event_type: input.eventType ?? "service.completed",
      allowed_event_types: [
        input.eventType ?? "service.completed",
        "contact.enroll",
        "service.completed",
        "appointment.completed",
        "invoice.paid",
        "order.fulfilled",
      ],
      send_delay_minutes: input.sendDelayMinutes ?? 0,
      duplicate_window_days: input.duplicateWindowDays ?? 90,
      field_mapping: input.fieldMapping ?? {},
      is_test: input.isTest ?? true,
      is_active: true,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    endpoint: mapRow(data),
    rawToken: token.raw,
    signingSecret,
  };
}

export async function listWebhookEndpoints(params: {
  organizationId: string;
  businessId?: string | null;
}): Promise<WebhookEndpointRow[]> {
  const supabase = createServiceClient();
  let q = supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (params.businessId) {
    q = q.or(`business_id.eq.${params.businessId},default_business_id.eq.${params.businessId}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getWebhookEndpoint(params: {
  organizationId: string;
  endpointId: string;
}): Promise<WebhookEndpointRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("id", params.endpointId)
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .maybeSingle();
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function resolveEndpointByToken(
  rawToken: string
): Promise<WebhookEndpointRow | null> {
  const hash = hashToken(rawToken);
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("endpoint_token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (data) {
    const row = mapRow(data as Record<string, unknown>);
    if (!safeEqualHex(row.endpoint_token_hash, hash)) return null;
    return row;
  }

  // Grace-period previous token
  const { data: prev } = await supabase
    .from("integration_webhook_endpoints")
    .select("*")
    .eq("previous_endpoint_token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!prev) return null;
  const row = mapRow(prev as Record<string, unknown>);
  if (
    row.previous_token_expires_at &&
    new Date(row.previous_token_expires_at).getTime() < Date.now()
  ) {
    return null;
  }
  return row;
}

export function getSigningSecrets(endpoint: WebhookEndpointRow): string[] {
  const secrets: string[] = [];
  if (endpoint.signing_secret_encrypted) {
    const s = decryptSecret(endpoint.signing_secret_encrypted);
    if (s) secrets.push(s);
  }
  if (
    endpoint.previous_signing_secret_encrypted &&
    endpoint.previous_signing_secret_expires_at &&
    new Date(endpoint.previous_signing_secret_expires_at).getTime() > Date.now()
  ) {
    const s = decryptSecret(endpoint.previous_signing_secret_encrypted);
    if (s) secrets.push(s);
  }
  return secrets;
}

export async function updateWebhookEndpoint(params: {
  organizationId: string;
  endpointId: string;
  patch: Partial<{
    name: string;
    description: string | null;
    is_active: boolean;
    is_test: boolean;
    campaign_id: string | null;
    default_campaign_id: string | null;
    send_delay_minutes: number;
    duplicate_window_days: number;
    signature_required: boolean;
    field_mapping: FieldMapping;
    allowed_event_types: string[];
    require_email_consent: boolean;
    require_sms_consent: boolean;
  }>;
}): Promise<WebhookEndpointRow> {
  const supabase = createServiceClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(params.patch)) {
    if (v !== undefined) clean[k] = v;
  }
  const { data, error } = await supabase
    .from("integration_webhook_endpoints")
    .update(clean)
    .eq("id", params.endpointId)
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Endpoint not found");
  return mapRow(data as Record<string, unknown>);
}

export async function rotateEndpointToken(params: {
  organizationId: string;
  endpointId: string;
  graceHours?: number;
}): Promise<{ endpoint: WebhookEndpointRow; rawToken: string }> {
  const existing = await getWebhookEndpoint(params);
  if (!existing) throw new Error("Endpoint not found");
  const token = generateEndpointToken();
  const graceMs = (params.graceHours ?? 24) * 3600_000;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_webhook_endpoints")
    .update({
      previous_endpoint_token_hash: existing.endpoint_token_hash,
      previous_token_expires_at: new Date(Date.now() + graceMs).toISOString(),
      endpoint_token_hash: token.hash,
      endpoint_token_last_four: token.lastFour,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.endpointId)
    .eq("organization_id", params.organizationId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { endpoint: mapRow(data as Record<string, unknown>), rawToken: token.raw };
}

export async function rotateSigningSecret(params: {
  organizationId: string;
  endpointId: string;
  graceHours?: number;
}): Promise<{ endpoint: WebhookEndpointRow; signingSecret: string }> {
  const existing = await getWebhookEndpoint(params);
  if (!existing) throw new Error("Endpoint not found");
  const secret = generateSigningSecret();
  const graceMs = (params.graceHours ?? 24) * 3600_000;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_webhook_endpoints")
    .update({
      previous_signing_secret_encrypted: existing.signing_secret_encrypted,
      previous_signing_secret_expires_at: new Date(Date.now() + graceMs).toISOString(),
      signing_secret_encrypted: encryptSecret(secret),
      signature_required: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.endpointId)
    .eq("organization_id", params.organizationId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { endpoint: mapRow(data as Record<string, unknown>), signingSecret: secret };
}

export async function revokeWebhookEndpoint(params: {
  organizationId: string;
  endpointId: string;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_webhook_endpoints")
    .update({
      revoked_at: new Date().toISOString(),
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.endpointId)
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
