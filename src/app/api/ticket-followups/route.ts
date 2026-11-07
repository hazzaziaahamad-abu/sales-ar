import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin } from "@/lib/permissions";
import { prepareDrafts, spreadSchedule, type FollowupCategory } from "@/lib/ticket-followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function superAdmin() {
  const user = await getAuthUser();
  if (!user || !(await isSuperAdmin(user.id))) return null;
  const { data } = await supabaseAdmin.from("user_profiles").select("name").eq("id", user.id).maybeSingle();
  return { id: user.id, name: ((data?.name as string | undefined) ?? "").trim() };
}

/** GET → المسودات المعلّقة + المجدولة + آخر المرسلة/الملغاة (٧ أيام). */
export async function GET() {
  if (!(await superAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [open, done] = await Promise.all([
    supabaseAdmin.from("ticket_followups").select("*").in("status", ["pending", "approved", "sending"])
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("ticket_followups").select("*").in("status", ["sent", "skipped", "rejected"])
      .gte("created_at", since).order("created_at", { ascending: false }).limit(100),
  ]);
  if (open.error) return NextResponse.json({ error: open.error.message }, { status: 500 });

  // آخر تعليق على كل عنصر مفتوح — عشان يقرر السوبر أدمن يوافق ولا لا
  const rows = open.data ?? [];
  const lastById = new Map<string, { author: string | null; body: string; created_at: string }>();
  const ids = [...new Set(rows.map((r) => r.ticket_id as string))];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabaseAdmin.rpc("followup_last_notes", { p_ids: ids.slice(i, i + 300) });
    for (const n of (data ?? []) as { item_id: string; author: string | null; body: string; created_at: string }[]) {
      const prev = lastById.get(n.item_id);
      if (!prev || n.created_at > prev.created_at) lastById.set(n.item_id, { author: n.author, body: n.body, created_at: n.created_at });
    }
  }
  // مرحلة العميل الحالية (مرحلة الصفقة / حالة التجديد أو التذكرة)
  const stageById = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabaseAdmin.rpc("followup_item_stages", { p_ids: ids.slice(i, i + 300) });
    for (const r of (data ?? []) as { item_id: string; stage: string | null }[]) if (r.stage) stageById.set(r.item_id, r.stage);
  }
  const withNotes = rows.map((r) => ({
    ...r,
    last_note: lastById.get(r.ticket_id as string) ?? null,
    stage: stageById.get(r.ticket_id as string) ?? null,
  }));
  return NextResponse.json({ open: withNotes, done: done.data ?? [] });
}

/**
 * POST
 *  { action: "approve", items: [{ id, body }] } → اعتماد + جدولة بأوقات متفرقة طبيعية
 *  { action: "reject", ids }                    → رفض (ما ينقترح العنصر مرة ثانية ٤٨ ساعة)
 *  { action: "unschedule", ids }                → إرجاع المجدولة لمسودات
 *  { action: "prepare" }                        → فحص العناصر الساكتة الحين
 */
export async function POST(req: NextRequest) {
  const me = await superAdmin();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await req.json().catch(() => ({}));
  const nowIso = new Date().toISOString();

  if (payload.action === "prepare") {
    return NextResponse.json({ ok: true, drafted: await prepareDrafts() });
  }

  if (payload.action === "approve") {
    const items = (Array.isArray(payload.items) ? payload.items : [])
      .map((i: { id?: unknown; body?: unknown }) => ({ id: String(i.id ?? ""), body: String(i.body ?? "").trim().slice(0, 2000) }))
      .filter((i: { id: string; body: string }) => i.id && i.body);
    if (!items.length) return NextResponse.json({ error: "ما فيه شي للاعتماد" }, { status: 400 });
    if (!me.name) return NextResponse.json({ error: "اسمك غير مضبوط في الملف الشخصي" }, { status: 400 });

    // كل قسم له نافذة إرسال: نجدول كل قسم لحاله بعد آخر موعد مجدول له، وبترتيب عشوائي
    const ids = items.map((i: { id: string }) => i.id);
    const catById = new Map<string, FollowupCategory>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabaseAdmin.from("ticket_followups").select("id, category, source").in("id", ids.slice(i, i + 200));
      for (const r of data ?? []) {
        catById.set(r.id as string, (r.category as FollowupCategory | null) ?? (r.source === "support" ? "ticket" : (r.source as FollowupCategory)));
      }
    }
    const groups = new Map<FollowupCategory, { id: string; body: string }[]>();
    for (const it of items as { id: string; body: string }[]) {
      const c = catById.get(it.id);
      if (!c) continue;
      groups.set(c, [...(groups.get(c) ?? []), it]);
    }

    const plan: { id: string; body: string; at: Date }[] = [];
    for (const [cat, list] of groups) {
      const { data: last } = await supabaseAdmin.from("ticket_followups").select("send_at")
        .eq("status", "approved").eq("category", cat).order("send_at", { ascending: false }).limit(1).maybeSingle();
      const after = last?.send_at ? new Date(last.send_at as string) : new Date();
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      const slots = spreadSchedule(shuffled.length, after, cat);
      shuffled.forEach((it, k) => plan.push({ ...it, at: slots[k] }));
    }

    let approved = 0;
    for (let i = 0; i < plan.length; i += 25) {
      const res = await Promise.all(plan.slice(i, i + 25).map((it) =>
        supabaseAdmin.from("ticket_followups")
          .update({ status: "approved", body: it.body, author_name: me.name, send_at: it.at.toISOString(), decided_at: nowIso })
          .eq("id", it.id).eq("status", "pending").select("id")));
      for (const r of res) approved += r.data?.length ?? 0;
    }
    return NextResponse.json({ ok: true, approved });
  }

  const ids = (Array.isArray(payload.ids) ? payload.ids : []).map(String).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "ما فيه شي" }, { status: 400 });

  if (payload.action === "reject") {
    for (let i = 0; i < ids.length; i += 200) {
      await supabaseAdmin.from("ticket_followups").update({ status: "rejected", decided_at: nowIso })
        .in("id", ids.slice(i, i + 200)).in("status", ["pending", "approved"]);
    }
    return NextResponse.json({ ok: true });
  }
  if (payload.action === "unschedule") {
    await supabaseAdmin.from("ticket_followups").update({ status: "pending", send_at: null })
      .in("id", ids).eq("status", "approved");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}
