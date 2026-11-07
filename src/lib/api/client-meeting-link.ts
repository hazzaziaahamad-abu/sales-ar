import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/permissions";
import { ORG_PRODUCT } from "@/lib/client-meetings";

export const CLIENT_MEETING_COLS =
  "id, org_id, deal_id, token, product, client_name, client_phone, rep_id, rep_name, stage_at_start, tier_name, open_count, first_opened_at, last_opened_at, created_at";

type Access = { userId: string; orgId: string; name: string | null };

/**
 * رابط «خطة اجتماع» واحد لكل صفقة: لو موجود نرجّعه، وإلا ننشئه باسم الموظف الحالي.
 * يُستخدم من زر خطة الاجتماع في المبيعات، ومن موعد العميل في التقويم.
 */
export async function ensureClientMeetingLink(dealId: string, access: Access):
  Promise<{ ok: true; meeting: Record<string, unknown> & { id: string; token: string }; deal: { id: string; client_name: string | null; client_phone: string | null } }
  | { ok: false; status: number; error: string }> {
  const { data: deal } = await supabaseAdmin
    .from("deals").select("id, org_id, client_name, client_phone, stage").eq("id", dealId).maybeSingle();
  if (!deal) return { ok: false, status: 404, error: "الصفقة غير موجودة" };
  if (deal.org_id !== access.orgId && !(await isSuperAdmin(access.userId))) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  const product = ORG_PRODUCT[deal.org_id];
  if (!product) return { ok: false, status: 400, error: "منتج غير معروف" };

  const { data: existing } = await supabaseAdmin
    .from("client_meetings").select(CLIENT_MEETING_COLS).eq("deal_id", dealId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return { ok: true, meeting: existing, deal };

  const { data, error } = await supabaseAdmin
    .from("client_meetings")
    .insert({
      org_id: deal.org_id,
      deal_id: deal.id,
      token: randomBytes(9).toString("base64url"),
      product,
      client_name: deal.client_name ?? "",
      client_phone: deal.client_phone ?? null,
      rep_id: access.userId,
      rep_name: access.name,
      stage_at_start: deal.stage ?? null,
    })
    .select(CLIENT_MEETING_COLS).single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? "تعذّر إنشاء الرابط" };
  return { ok: true, meeting: data, deal };
}
