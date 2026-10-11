import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { timelineOf, type IdeaSticker, type TimelineStep } from "@/lib/idea-stickers";

export const runtime = "nodejs";

/**
 * POST /api/idea-stickers/[id]/timeline — تايم لاين التنفيذ (صاحب الفكرة أو المدراء).
 * { action: "toggle", key }        → إنجاز الخطوة (بالوقت والاسم) أو التراجع عنها
 * { action: "add", label }         → خطوة جديدة في آخر التايم لاين
 * { action: "remove", key }        → حذف خطوة
 * { action: "due", due_at | null } → موعد التنفيذ المستهدف (YYYY-MM-DD)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: sticker } = await supabaseAdmin
    .from("idea_stickers").select("*").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!sticker) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (!access.isManager && sticker.created_by !== access.userId) {
    return NextResponse.json({ error: "تقدر تحدّث تنفيذ أفكارك فقط" }, { status: 403 });
  }

  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const steps: TimelineStep[] = timelineOf(sticker as IdeaSticker).map((s) => ({ ...s }));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const key = typeof b.key === "string" ? b.key : "";

  switch (b.action) {
    case "toggle": {
      const step = steps.find((s) => s.key === key);
      if (!step) return NextResponse.json({ error: "الخطوة غير موجودة" }, { status: 404 });
      if (step.done_at) { step.done_at = null; step.done_by = null; }
      else { step.done_at = new Date().toISOString(); step.done_by = access.name ?? null; }
      patch.timeline = steps;
      break;
    }
    case "add": {
      const label = typeof b.label === "string" ? b.label.trim().slice(0, 80) : "";
      if (!label) return NextResponse.json({ error: "اكتب اسم الخطوة" }, { status: 400 });
      if (steps.length >= 20) return NextResponse.json({ error: "الحد الأقصى ٢٠ خطوة" }, { status: 400 });
      steps.push({ key: `s${Date.now().toString(36)}`, label, done_at: null, done_by: null });
      patch.timeline = steps;
      break;
    }
    case "remove": {
      const next = steps.filter((s) => s.key !== key);
      if (next.length === steps.length) return NextResponse.json({ error: "الخطوة غير موجودة" }, { status: 404 });
      if (!next.length) return NextResponse.json({ error: "لازم تبقى خطوة وحدة على الأقل" }, { status: 400 });
      patch.timeline = next;
      break;
    }
    case "due": {
      const v = b.due_at;
      if (v === null || v === "") patch.due_at = null;
      else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) patch.due_at = v;
      else return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
      break;
    }
    default:
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("idea_stickers").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sticker: data });
}
