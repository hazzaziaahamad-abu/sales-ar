import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// رابط خطة الاجتماع العام (/offer/meeting?m=<token>) — بدون تسجيل دخول.
// يرجّع اسم العميل والمنتج فقط، ويسجّل فتح الرابط والباقة المختارة.
export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };

const validToken = (t: string) => /^[A-Za-z0-9_-]{8,40}$/.test(t);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  if (!validToken(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await supabaseAdmin
    .from("client_meetings").select("id, product, client_name, open_count, first_opened_at").eq("token", token).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("client_meetings")
    .update({ open_count: (data.open_count ?? 0) + 1, last_opened_at: now, first_opened_at: data.first_opened_at ?? now })
    .eq("id", data.id);

  return NextResponse.json(
    { product: data.product, client_name: data.client_name },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST { tier } → الباقة اللي اختارها العميل أثناء العرض. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  if (!validToken(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { tier?: unknown };
  const tier = typeof body.tier === "string" ? body.tier.trim().slice(0, 80) : "";
  if (!tier) return NextResponse.json({ error: "tier مطلوب" }, { status: 400 });
  const { error } = await supabaseAdmin.from("client_meetings").update({ tier_name: tier }).eq("token", token);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
