import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LEN = 32;

export async function hashSharePassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifySharePassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedB64] = parts;
  if (!salt || !expectedB64) return false;
  try {
    const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
    const expected = Buffer.from(expectedB64, "base64url");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Cookie name for a short-lived share unlock token (prefix of stored hash). */
export function shareUnlockCookieName(shareTokenHash: string): string {
  const prefix = shareTokenHash.slice(0, 12).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `share_unlock_${prefix}`;
}

export const SHARE_UNLOCK_COOKIE_MAX_AGE_SEC = 60 * 60;
