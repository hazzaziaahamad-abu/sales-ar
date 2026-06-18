/**
 * Signed payloads for the public task-card image route.
 *
 * The card image must be fetchable without a login (the WhatsApp gateway pulls
 * it, and employees open the link), so we HMAC-sign the payload with CRON_SECRET
 * to keep the URL unforgeable and non-enumerable.
 */

import crypto from "node:crypto";

export interface CardStat {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}

export interface CardPayload {
  /** visual template */
  t: "performance" | "announcement" | "reminder";
  title: string;
  name?: string;
  body?: string;
  stats?: CardStat[];
  org?: string;
}

function secret(): string {
  return process.env.CRON_SECRET || process.env.WA_WEBHOOK_SECRET || "dev-card-secret";
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signCardToken(payload: CardPayload): string {
  const data = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyCardToken(token: string): CardPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac("sha256", secret()).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(b64urlDecode(data).toString("utf8")) as CardPayload;
  } catch {
    return null;
  }
}

/** Public base URL for building absolute links (gateway/employees fetch these). */
export function appBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function buildCardUrl(payload: CardPayload): string {
  return `${appBaseUrl()}/api/render/task-card?token=${encodeURIComponent(signCardToken(payload))}`;
}
