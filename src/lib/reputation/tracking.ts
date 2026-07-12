import { randomBytes } from "crypto";

export function generateTrackingToken(): string {
  return randomBytes(16).toString("base64url");
}

export function buildTrackingUrl(token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
  return `${base}/r/${token}`;
}

export function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = (h << 5) - h + ip.charCodeAt(i);
  return `ip_${Math.abs(h)}`;
}
