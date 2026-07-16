import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/db/client";

export type ApiKeyRecord = {
  id: string;
  organizationId: string;
  businessId: string | null;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type VerifiedApiKey = {
  id: string;
  organizationId: string;
  businessId: string | null;
  scopes: string[];
};

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const prefixPart = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const prefix = `lse_${prefixPart}`;
  const raw = `${prefix}_${secret}`;
  return { raw, prefix, hash: hashApiKey(raw) };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Extract bearer / x-api-key from a request. */
export function extractApiKeyFromRequest(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }
  const url = new URL(request.url);
  const q = url.searchParams.get("api_key")?.trim();
  return q || null;
}

export async function verifyApiKey(raw: string): Promise<VerifiedApiKey | null> {
  const key = raw.trim();
  if (!key.startsWith("lse_")) return null;
  const hash = hashApiKey(key);
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organization_api_keys")
    .select("id, organization_id, business_id, scopes, key_hash, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!data || data.revoked_at) return null;
  if (!safeEqualHex(String(data.key_hash), hash)) return null;

  await supabase
    .from("organization_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id as string,
    organizationId: data.organization_id as string,
    businessId: (data.business_id as string | null) ?? null,
    scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : ["automation"],
  };
}

export async function createOrganizationApiKey(params: {
  organizationId: string;
  businessId?: string | null;
  name?: string;
  createdBy?: string | null;
  scopes?: string[];
}): Promise<{ key: ApiKeyRecord; raw: string }> {
  const generated = generateApiKey();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organization_api_keys")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId ?? null,
      name: params.name?.trim() || "Automation key",
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      scopes: params.scopes ?? ["automation"],
      created_by: params.createdBy ?? null,
    })
    .select("id, organization_id, business_id, name, key_prefix, scopes, last_used_at, revoked_at, created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    raw: generated.raw,
    key: mapKeyRow(data),
  };
}

export async function listOrganizationApiKeys(organizationId: string): Promise<ApiKeyRecord[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organization_api_keys")
    .select("id, organization_id, business_id, name, key_prefix, scopes, last_used_at, revoked_at, created_at")
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapKeyRow);
}

export async function revokeOrganizationApiKey(params: {
  organizationId: string;
  keyId: string;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("organization_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.keyId)
    .eq("organization_id", params.organizationId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

function mapKeyRow(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    businessId: (row.business_id as string | null) ?? null,
    name: row.name as string,
    keyPrefix: row.key_prefix as string,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
