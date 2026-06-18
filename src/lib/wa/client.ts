/**
 * OpenWA gateway client (server-side only).
 *
 * Wraps the OpenWA REST API (https://github.com/rmyndharis/OpenWA).
 * Auth is via the `X-API-Key` header.
 *
 * MULTI-TENANT MODEL: one WhatsApp session per organization. Each org's
 * session is named deterministically (`dash-org-<orgId>`) so it can be
 * resolved/created on demand without a database. We NEVER touch sessions we
 * didn't create (e.g. the legacy `rawasm` session used by the old project) —
 * all lookups go through the `dash-org-` naming convention.
 */

const WA_API_URL = process.env.WA_API_URL;
const WA_API_KEY = process.env.WA_API_KEY;
const WA_WEBHOOK_URL = process.env.WA_PUBLIC_WEBHOOK_URL;
const WA_WEBHOOK_SECRET = process.env.WA_WEBHOOK_SECRET;

/** Raw status values reported by the gateway. */
export type WaRawStatus =
  | "created"
  | "initializing"
  | "qr_ready"
  | "authenticating"
  | "ready"
  | "disconnected"
  | "failed";

export interface WaSession {
  id: string;
  name: string;
  status: WaRawStatus | string;
  phone?: string | null;
  pushName?: string | null;
  connectedAt?: string | null;
  lastActive?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WaQr {
  qrCode?: string; // data:image/png;base64,...
  status?: string;
}

const SESSION_PREFIX = "dash-org-";

export function isWaConfigured(): boolean {
  return Boolean(WA_API_URL && WA_API_KEY);
}

/** Deterministic gateway session name for an organization. */
export function sessionNameForOrg(orgId: string): string {
  const safe = String(orgId).toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `${SESSION_PREFIX}${safe}`.slice(0, 50);
}

/** Extract the org id from a `dash-org-<orgId>` session name, or null. */
export function orgIdFromSessionName(name: string | undefined | null): string | null {
  if (!name || !name.startsWith(SESSION_PREFIX)) return null;
  return name.slice(SESSION_PREFIX.length) || null;
}

/** True for any status meaning the number is paired & online. */
export function isConnectedStatus(status: string | undefined | null): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "ready" || s === "authenticated";
}

function baseUrl(): string {
  if (!WA_API_URL) throw new Error("WA_API_URL is not set");
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
    cache: "no-store",
  });
}

// The gateway rate-limits requests, so we cache the session list briefly and
// de-duplicate concurrent calls. Multiple resolveOrgSession() calls within one
// request (or within a poll window) then cost a single upstream fetch.
let _sessionsCache: { at: number; data: WaSession[] } | null = null;
let _sessionsInflight: Promise<WaSession[]> | null = null;
const SESSIONS_TTL_MS = 3000;

// When the gateway returns 429, we stop hitting it until this timestamp and
// serve stale cache instead — so we never make the throttle worse.
let _cooldownUntil = 0;
let _lastRetryAfterSec = 0;

/** Error thrown when the gateway is rate-limited and we have no cached data. */
export class WaRateLimitError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(`OpenWA rate-limited; retry after ${retryAfterSec}s`);
    this.name = "WaRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export function waCooldownRemainingSec(): number {
  return Math.max(0, Math.ceil((_cooldownUntil - Date.now()) / 1000));
}

/** Parse the largest retry-after-* hint from a 429 response. */
function parseRetryAfter(res: Response): number {
  const keys = ["retry-after", "retry-after-long", "retry-after-medium", "retry-after-short"];
  let max = 0;
  for (const k of keys) {
    const n = Number(res.headers.get(k));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return max || 30;
}

/** List all sessions on the gateway (cache + in-flight dedup + 429 backoff). */
export async function listSessions(force = false): Promise<WaSession[]> {
  if (!force && _sessionsCache && Date.now() - _sessionsCache.at < SESSIONS_TTL_MS) {
    return _sessionsCache.data;
  }
  if (!force && _sessionsInflight) return _sessionsInflight;

  // In cooldown: never hit the gateway. Serve stale cache, or signal the limit.
  if (Date.now() < _cooldownUntil) {
    if (_sessionsCache) return _sessionsCache.data;
    throw new WaRateLimitError(waCooldownRemainingSec() || _lastRetryAfterSec);
  }

  _sessionsInflight = (async () => {
    const res = await waFetch("/sessions");
    if (res.status === 429) {
      _lastRetryAfterSec = parseRetryAfter(res);
      // Re-check periodically (other windows reset) rather than waiting the
      // full long-window penalty, capped so we don't hammer.
      _cooldownUntil = Date.now() + Math.min(_lastRetryAfterSec, 60) * 1000;
      if (_sessionsCache) return _sessionsCache.data;
      throw new WaRateLimitError(_lastRetryAfterSec);
    }
    if (!res.ok) throw new Error(`OpenWA listSessions failed: ${res.status}`);
    const data = await res.json();
    const list: WaSession[] = Array.isArray(data) ? data : data?.sessions ?? [];
    _sessionsCache = { at: Date.now(), data: list };
    _cooldownUntil = 0;
    return list;
  })();
  try {
    return await _sessionsInflight;
  } finally {
    _sessionsInflight = null;
  }
}

/** Invalidate the session cache (after create/delete/start). */
function invalidateSessionsCache() {
  _sessionsCache = null;
}

/** Get a session by its gateway id. */
export async function getSessionById(id: string): Promise<WaSession | null> {
  const res = await waFetch(`/sessions/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenWA getSession failed: ${res.status}`);
  return res.json();
}

/** Find the session belonging to an org (by naming convention), or null. */
export async function resolveOrgSession(orgId: string): Promise<WaSession | null> {
  const name = sessionNameForOrg(orgId);
  const sessions = await listSessions();
  return sessions.find((s) => s.name === name) ?? null;
}

/** Create a new session for an org. */
async function createOrgSession(orgId: string): Promise<WaSession> {
  const res = await waFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({ name: sessionNameForOrg(orgId) }),
  });
  if (res.status === 409) {
    // Race: someone created it — just resolve.
    const existing = await resolveOrgSession(orgId);
    if (existing) return existing;
  }
  if (!res.ok) throw new Error(`OpenWA createSession failed: ${res.status}`);
  invalidateSessionsCache();
  return res.json();
}

/** Start a session (begins WhatsApp connection / QR generation). */
async function startSession(id: string): Promise<void> {
  // 400 = already started; treat as success.
  await waFetch(`/sessions/${id}/start`, { method: "POST" }).catch(() => {});
  invalidateSessionsCache();
}

/** Stop a session (disconnects WhatsApp but keeps the session record). */
export async function stopOrgSession(orgId: string): Promise<boolean> {
  const session = await resolveOrgSession(orgId);
  if (!session) return false;
  const res = await waFetch(`/sessions/${session.id}/stop`, { method: "POST" });
  return res.ok;
}

/**
 * Delete an org's session entirely. Use this to "switch numbers": after
 * deletion, the next connect() creates a fresh session and shows a new QR.
 */
export async function deleteOrgSession(orgId: string): Promise<boolean> {
  const session = await resolveOrgSession(orgId);
  if (!session) return true;
  const res = await waFetch(`/sessions/${session.id}`, { method: "DELETE" });
  invalidateSessionsCache();
  return res.ok || res.status === 404;
}

/**
 * Ensure an org has a started session, register our webhook, and return it.
 * Creates the session if it doesn't exist. Never affects other sessions.
 */
export async function ensureOrgSession(orgId: string): Promise<WaSession | null> {
  let session = await resolveOrgSession(orgId);
  if (!session) {
    session = await createOrgSession(orgId);
  }
  if (session?.id) {
    await startSession(session.id);
    await registerWebhook(session.id).catch(() => {});
    session = (await getSessionById(session.id)) ?? session;
  }
  return session;
}

/** Fetch the QR for a known session, or null if not available. */
async function fetchQr(session: WaSession): Promise<WaQr | null> {
  if (isConnectedStatus(session.status)) return null;
  const res = await waFetch(`/sessions/${session.id}/qr`);
  // 400 = not ready yet or already authenticated.
  if (res.status === 400 || res.status === 404 || res.status === 409) return null;
  if (!res.ok) throw new Error(`OpenWA getQr failed: ${res.status}`);
  return res.json();
}

/** Get the QR code for an org's session, or null if none/connected. */
export async function getOrgQr(orgId: string): Promise<WaQr | null> {
  const session = await resolveOrgSession(orgId);
  if (!session) return null;
  return fetchQr(session);
}

/**
 * Single-call snapshot for the UI: the org's session plus its QR (when not
 * connected). Uses the cached session list, so polling this costs at most one
 * `/sessions` fetch (cached) + one `/qr` fetch per window.
 */
export async function getOrgSnapshot(
  orgId: string
): Promise<{ session: WaSession | null; qr: WaQr | null }> {
  const session = await resolveOrgSession(orgId);
  if (!session) return { session: null, qr: null };
  const qr = isConnectedStatus(session.status)
    ? null
    : await fetchQr(session).catch(() => null);
  return { session, qr };
}

/** Register our inbound webhook with the gateway for a session. */
export async function registerWebhook(sessionId: string): Promise<boolean> {
  if (!WA_WEBHOOK_URL || WA_WEBHOOK_URL.includes("localhost")) return false;
  const res = await waFetch(`/sessions/${sessionId}/webhooks`, {
    method: "POST",
    body: JSON.stringify({
      url: WA_WEBHOOK_URL,
      events: ["message.received", "session.status"],
      secret: WA_WEBHOOK_SECRET,
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Send a plain text message from an org's session. */
export async function sendTextFromOrg(
  orgId: string,
  to: string,
  text: string
): Promise<unknown> {
  const session = await resolveOrgSession(orgId);
  if (!session) throw new Error("No WhatsApp session for this organization");
  if (!isConnectedStatus(session.status)) {
    throw new Error("WhatsApp number is not connected");
  }
  const chatId = to.includes("@") ? to : `${to.replace(/[^\d]/g, "")}@c.us`;
  const res = await waFetch(`/sessions/${session.id}/messages/send-text`, {
    method: "POST",
    body: JSON.stringify({ chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenWA sendText failed: ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * Send an image (by public URL) with an optional caption from an org's session.
 *
 * The gateway's media endpoint isn't guaranteed, so if `send-image` is missing
 * we fall back to a plain-text message containing the caption + the image URL —
 * the recipient still gets the link, which is the core requirement.
 */
export async function sendImageFromOrg(
  orgId: string,
  to: string,
  imageUrl: string,
  caption = ""
): Promise<unknown> {
  const session = await resolveOrgSession(orgId);
  if (!session) throw new Error("No WhatsApp session for this organization");
  if (!isConnectedStatus(session.status)) {
    throw new Error("WhatsApp number is not connected");
  }
  const chatId = to.includes("@") ? to : `${to.replace(/[^\d]/g, "")}@c.us`;

  const res = await waFetch(`/sessions/${session.id}/messages/send-image`, {
    method: "POST",
    body: JSON.stringify({ chatId, url: imageUrl, image: imageUrl, caption }),
  }).catch(() => null);

  if (res && res.ok) return res.json();

  // Fallback: gateway doesn't support image media — send caption + link as text.
  const text = caption ? `${caption}\n${imageUrl}` : imageUrl;
  return sendTextFromOrg(orgId, to, text);
}
