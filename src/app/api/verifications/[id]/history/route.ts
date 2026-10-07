import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import type { VerifyItem } from "@/lib/verifications";

export const runtime = "nodejs";

export interface HistoryEntry {
  kind: "log" | "note";
  at: string;
  by: string | null;
  text: string;
}

/**
 * GET /api/verifications/[id]/history?entity_id=…
 * سجل عميل من قائمة طلب التحقق: عمليات النظام (activity_logs) + ملاحظات المتابعة.
 * للمدير، أو للموظف المكلَّف بالطلب.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const entityId = req.nextUrl.searchParams.get("entity_id") ?? "";

  const { data: request } = await supabaseAdmin.from("verification_requests")
    .select("assignee_id, items").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!request) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (!access.isManager && request.assignee_id !== access.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(request.items as VerifyItem[]).some((it) => it.entity_id === entityId)) {
    return NextResponse.json({ error: "العميل مو في هذا الطلب" }, { status: 400 });
  }

  const [logs, notes] = await Promise.all([
    supabaseAdmin.from("activity_logs").select("action, details, user_name, created_at")
      .eq("org_id", access.orgId).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("follow_up_notes").select("note, author_name, created_at")
      .eq("org_id", access.orgId).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(100),
  ]);

  const ACTION: Record<string, string> = { create: "إضافة", update: "تعديل", delete: "حذف" };
  const entries: HistoryEntry[] = [
    ...(logs.data ?? []).map((l) => ({ kind: "log" as const, at: l.created_at, by: l.user_name, text: l.details || ACTION[l.action] || l.action })),
    ...(notes.data ?? []).map((n) => ({ kind: "note" as const, at: n.created_at, by: n.author_name, text: n.note })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return NextResponse.json({ entries });
}
