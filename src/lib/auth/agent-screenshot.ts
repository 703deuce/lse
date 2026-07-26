import { timingSafeEqual } from "node:crypto";

/**
 * Secret-gated login for cloud agents / Playwright so they can open the live
 * app as a real user (not the Dev User bypass chrome).
 *
 * Coolify + Cursor env:
 *   AGENT_SCREENSHOT_SECRET=<32+ char random>
 *   AGENT_SCREENSHOT_EMAIL=whywriteit@gmail.com
 */
export function getAgentScreenshotSecret(): string | null {
  const secret = process.env.AGENT_SCREENSHOT_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return secret;
}

export function getAgentScreenshotEmail(): string | null {
  const email = process.env.AGENT_SCREENSHOT_EMAIL?.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

export function isAgentScreenshotConfigured(): boolean {
  return Boolean(getAgentScreenshotSecret() && getAgentScreenshotEmail());
}

export function agentScreenshotSecretMatches(provided: string | null | undefined): boolean {
  const expected = getAgentScreenshotSecret();
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
