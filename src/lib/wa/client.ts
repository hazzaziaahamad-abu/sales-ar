/**
 * OpenWA gateway client (server-side only).
 *
 * Wraps the OpenWA REST API (https://github.com/rmyndharis/OpenWA).
 * Auth is via the `X-API-Key` header. The session we operate on is configured
 * through WA_SESSION_ID — which may be either the session UUID or its
 * human-readable name; `resolveSessionId` handles both.
 */

const WA_API_URL = process.env.WA_API_URL;
const WA_API_KEY = process.env.WA_API_KEY;
const WA_SESSION = process.env.WA_SESSION_ID;
const WA_WEBHOOK_URL = process.env.WA_PUBLIC_WEBHOOK_URL;
const WA_WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET;

export type WaStatus =
  | "INITIALIZING"
  | "SCAN_QR"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "FAILED";

export interface WaSession {
  id: string;
  name: string;
  status: WaStatus;
  phoneNumber?: string | null;
  createdAt?: string;
}

export interface WaQr {
  code?: string;
  /** data:image/png;base64,... */
  image?: string;
}

export function isWaConfigured(): boolean {
  return Boolean(WA_API_URL && WA_API_KEY && WA_SESSION);
}

function baseUrl(): string {
  if (!WA_API_URL) throw new Error("WA_API_URL is not set");
  // Gateway exposes the REST API under /api
  return WA_API_URL.replace(/\/+$/, "") + "/api";
}

async function waFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!WA_API_KEY) throw new Error("WA_API_KEY is not set");
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "X-API-Key": WA_API_KEY,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    // The gateway state changes frequently — never cache.
    cache: "no-store",
  });
}

/** List all sessions on the gateway. */
export async function listSessions(): Promise<WaSession[]> {
  const res = await waFetch("/sessions");
  if (!res.ok) throw new Error(`OpenWA listSessions failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data?.sessions ?? [];
}

/**
 * Resolve the configured WA_SESSION_ID to the gateway's canonical session id.
 * WA_SESSION_ID may be the UUID or the name; we look it up either way and fall
 * back to using the raw value directly if the session list is unavailable.
 */
let cachedSessionId: string | null = null;
export async function resolveSessionId(): Promise<string> {
  if (!WA_SESSION) throw new Error("WA_SESSION_ID is not set");
  if (cachedSessionId) return cachedSessionId;
  try {
    const sessions = await listSessions();
    const match = sessions.find(
      (s) => s.id === WA_SESSION || s.name === WA_SESSION
    );
    cachedSessionId = match?.id ?? WA_SESSION;
  } catch {
    cachedSessionId = WA_SESSION;
  }
  return cachedSessionId;
}

/** Get the current session record (status, phone number, etc). */
export async function getSession(): Promise<WaSession | null> {
  const id = await resolveSessionId();
  const res = await waFetch(`/sessions/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenWA getSession failed: ${res.status}`);
  return res.json();
}

/**
 * Make sure the session exists and is started so a QR can be generated.
 * Creates it if missing, then starts it. Safe to call repeatedly.
 */
export async function ensureSessionStarted(): Promise<WaSession | null> {
  let session = await getSession();
  if (!session) {
    // Create with the configured value as the name.
    const createRes = await waFetch("/sessions", {
      method: "POST",
      body: JSON.stringify({ name: WA_SESSION }),
    });
    if (createRes.ok) {
      session = await createRes.json();
      cachedSessionId = session?.id ?? cachedSessionId;
    }
  }
  const id = cachedSessionId ?? (await resolveSessionId());
  // Starting an already-started session is a no-op on the gateway.
  await waFetch(`/sessions/${id}/start`, { method: "POST" }).catch(() => {});
  return getSession();
}

/**
 * Register our inbound webhook with the gateway so it forwards incoming
 * messages + status changes to us. Idempotent-ish: safe to call on connect.
 * Skipped if the webhook URL still points at localhost (not reachable by the
 * remote gateway).
 */
export async function registerWebhook(): Promise<boolean> {
  if (!WA_WEBHOOK_URL || WA_WEBHOOK_URL.includes("localhost")) return false;
  const id = await resolveSessionId();
  const res = await waFetch(`/sessions/${id}/webhooks`, {
    method: "POST",
    body: JSON.stringify({
      url: WA_WEBHOOK_URL,
      events: ["message.received", "session.status"],
      secret: WA_WEBHOOK_SECRET,
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Fetch the QR code for scanning. */
export async function getQr(): Promise<WaQr | null> {
  const id = await resolveSessionId();
  const res = await waFetch(`/sessions/${id}/qr`);
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) throw new Error(`OpenWA getQr failed: ${res.status}`);
  return res.json();
}

/** Send a plain text message. `to` may be a bare phone number or a chatId. */
export async function sendText(to: string, text: string): Promise<unknown> {
  const id = await resolveSessionId();
  const chatId = to.includes("@") ? to : `${to.replace(/[^\d]/g, "")}@c.us`;
  const res = await waFetch(`/sessions/${id}/messages/send-text`, {
    method: "POST",
    body: JSON.stringify({ chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWA sendText failed: ${res.status} ${body}`);
  }
  return res.json();
}
