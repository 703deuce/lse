import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

const TOKEN_PREFIX = "lsewh_";

export function generateEndpointToken(): { raw: string; hash: string; lastFour: string } {
  // 32 bytes = 256 bits entropy
  const secret = randomBytes(32).toString("base64url");
  const raw = `${TOKEN_PREFIX}${secret}`;
  return { raw, hash: hashToken(raw), lastFour: raw.slice(-4) };
}

export function generateSigningSecret(): string {
  return `whsig_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function safeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function encryptionKey(): Buffer {
  const material =
    process.env.INTEGRATION_SECRET_KEY?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim() ||
    "";
  if (!material) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("INTEGRATION_SECRET_KEY is required in production");
    }
    return createHash("sha256").update("dev-integration-secret-key").digest();
  }
  return createHash("sha256").update(material).digest();
}

/** AES-256-GCM encrypt for at-rest signing secrets. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(blob: string): string | null {
  try {
    const [ver, ivB64, tagB64, dataB64] = blob.split(".");
    if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

/** HMAC-SHA256 over `${timestamp}.${rawBody}` → hex digest. */
export function signWebhookBody(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyWebhookSignature(params: {
  secrets: string[];
  timestamp: string;
  rawBody: string;
  signatureHeader: string;
  toleranceSeconds?: number;
}): boolean {
  const tol = params.toleranceSeconds ?? 300;
  const ts = Number(params.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > tol) return false;

  const provided = params.signatureHeader.trim().replace(/^sha256=/i, "");
  for (const secret of params.secrets) {
    if (!secret) continue;
    const expected = signWebhookBody(secret, params.timestamp, params.rawBody);
    if (safeEqualUtf8(expected, provided)) return true;
  }
  return false;
}

export function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, 32);
}
