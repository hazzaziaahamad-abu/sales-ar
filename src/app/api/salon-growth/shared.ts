import { NextResponse } from "next/server";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { SETTING_KEYS, intlPhone, isSaudiMobile, type Addon, type PlanIcon } from "@/lib/salon-growth";

/** صلاحية «لوحة نمو الصالون»: أي مستخدم مسجّل في المنظمة يقرأ ويكتب؛ الحذف للمدراء. */
export async function getSalonAccess() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return access;
}

const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
};

export function parseAddons(v: unknown): Addon[] | null {
  if (!Array.isArray(v)) return null;
  return v.slice(0, 20).map((o) => ({ name: str((o as Addon)?.name, 80), price: num((o as Addon)?.price, 0, 100000, 0) })).filter((o) => o.name);
}

export function parseNewAppointment(b: Record<string, unknown>):
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string } {
  const client_name = str(b.client_name, 100);
  if (client_name.length < 2) return { ok: false, error: "اسم العميلة مطلوب" };
  if (!isSaudiMobile(String(b.phone ?? ""))) return { ok: false, error: "رقم جوال غير صالح" };
  const service = str(b.service, 100);
  const staff = str(b.staff, 50);
  if (!service || !staff) return { ok: false, error: "الخدمة والخبيرة مطلوبتان" };
  const t = Date.parse(String(b.starts_at ?? ""));
  if (!Number.isFinite(t)) return { ok: false, error: "وقت غير صالح" };
  return {
    ok: true,
    fields: {
      client_name, phone: intlPhone(String(b.phone)), service, staff,
      starts_at: new Date(t).toISOString(),
      duration_minutes: Math.round(num(b.duration_minutes, 5, 600, 60)),
      price: num(b.price, 0, 100000, 0),
      kind: b.kind === "walkin" ? "walkin" : "booking",
    },
  };
}

export function parseMembership(b: Record<string, unknown>, partial: boolean):
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string } {
  const f: Record<string, unknown> = {};
  const has = (k: string) => k in b;
  if (!partial || has("name")) {
    const name = str(b.name, 100);
    if (name.length < 2) return { ok: false, error: "اسم الباقة مطلوب" };
    f.name = name;
  }
  if (!partial || has("price")) f.price = num(b.price, 0, 1000000, 0);
  if (!partial || has("period")) f.period = str(b.period, 40) || "شهرياً";
  if (!partial || has("perks")) f.perks = Array.isArray(b.perks) ? b.perks.map((p) => str(p, 120)).filter(Boolean).slice(0, 12) : [];
  if (!partial || has("icon")) f.icon = (["crown", "gem", "gift"] as PlanIcon[]).includes(b.icon as PlanIcon) ? b.icon : "gem";
  if (has("members")) f.members = Math.round(num(b.members, 0, 1000000, 0));
  if (has("active")) f.active = !!b.active;
  return { ok: true, fields: f };
}

export function isSettingKey(k: unknown): k is (typeof SETTING_KEYS)[number] {
  return SETTING_KEYS.includes(k as never);
}

/** يجلب كل الصفوف على دفعات (PostgREST يرجّع ١٠٠٠ صف كحد أقصى للطلب). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cap = 10000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** numeric يرجع من PostgREST أحياناً كنص — نوحّده لأرقام. */
export const toNum = <T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T => {
  const r = { ...row };
  for (const k of keys) r[k] = Number(r[k] ?? 0) as T[keyof T];
  return r;
};
