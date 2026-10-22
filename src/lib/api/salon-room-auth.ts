/**
 * دخول «غرفة التخطيط والتنفيذ» بكود فريق — بدون حسابات منصة للمستشارين.
 *
 * - الكود يُخزَّن كبصمة scrypt مع salt (ما يُخزَّن الكود نفسه).
 * - الدخول الناجح يعطي كوكي HttpOnly موقّع HMAC فيه المنظمة ونسخة الكود؛
 *   تغيير الكود يغيّر النسخة فتسقط كل الجلسات القديمة تلقائياً.
 * - محاولات الدخول الخاطئة محدودة لكل IP (ذاكرة السيرفر — تتصفّر مع إعادة التشغيل).
 */

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ROOM_COOKIE } from "@/lib/salon-room";

const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60_000;

function secret(): string {
  const s = process.env.SALON_ROOM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SALON_ROOM_SECRET غير مضبوط");
  return crypto.createHash("sha256").update(`salon-room:${s}`).digest("hex");
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function hashCode(code: string, salt: string): string {
  return crypto.scryptSync(code.normalize("NFKC"), salt, 32).toString("hex");
}
export const newSalt = () => crypto.randomBytes(16).toString("hex");

function codeMatches(code: string, salt: string, hash: string): boolean {
  const a = Buffer.from(hashCode(code, salt), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type Token = { o: string; v: number; e: number };

function sign(t: Token): string {
  const data = b64url(Buffer.from(JSON.stringify(t), "utf8"));
  return `${data}.${b64url(crypto.createHmac("sha256", secret()).update(data).digest())}`;
}

function verify(token: string): Token | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(b64url(crypto.createHmac("sha256", secret()).update(data).digest()));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const t = JSON.parse(Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Token;
    return t.e > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export function setRoomCookie(res: NextResponse, orgId: string, codeSetAt: string) {
  const token = sign({ o: orgId, v: Date.parse(codeSetAt), e: Date.now() + SESSION_DAYS * 86_400_000 });
  res.cookies.set(ROOM_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86_400,
  });
}
export function clearRoomCookie(res: NextResponse) {
  res.cookies.set(ROOM_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/* ─── حدّ المحاولات ─── */
const fails = new Map<string, { n: number; until: number }>();
export const clientIp = (req: NextRequest) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
export function lockedFor(ip: string): number {
  const f = fails.get(ip);
  return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60_000) : 0;
}
function recordFail(ip: string) {
  const f = fails.get(ip);
  const n = (f && f.until > Date.now() ? 0 : f?.n ?? 0) + 1;
  fails.set(ip, { n: n >= MAX_FAILS ? 0 : n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
}

/** يتحقق من الكود مقابل كل المنظمات اللي فعّلت الغرفة ويرجع المنظمة المطابقة. */
export async function checkCode(ip: string, code: string): Promise<{ orgId: string; codeSetAt: string } | null> {
  const { data } = await supabaseAdmin.from("consult_room_settings").select("org_id, code_hash, code_salt, code_set_at");
  const hit = (data ?? []).find((r) => codeMatches(code, r.code_salt, r.code_hash));
  if (!hit) { recordFail(ip); return null; }
  fails.delete(ip);
  return { orgId: hit.org_id, codeSetAt: hit.code_set_at };
}

/** صلاحية مسارات الغرفة: كوكي صالح + نسخة الكود الحالية. يرجع المنظمة واسم المستشارة (من الواجهة). */
export async function getRoomAccess(req: NextRequest): Promise<{ orgId: string; author: string | null } | NextResponse> {
  const token = req.cookies.get(ROOM_COOKIE)?.value;
  const t = token ? verify(token) : null;
  if (!t) return NextResponse.json({ error: "أدخل كود الدخول" }, { status: 401 });
  const { data } = await supabaseAdmin.from("consult_room_settings").select("code_set_at").eq("org_id", t.o).maybeSingle();
  if (!data || Date.parse(data.code_set_at) !== t.v) return NextResponse.json({ error: "انتهت الجلسة — أدخل الكود الجديد" }, { status: 401 });
  let author: string | null = null;
  try { author = decodeURIComponent(req.headers.get("x-room-user") ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || null; } catch { /* ignore */ }
  return { orgId: t.o, author };
}
