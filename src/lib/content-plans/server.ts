// منطق «التسويق بالمحتوى» على الخادم — يستخدمه مسار المستخدم المسجّل ومسار الرابط العام معاً.
// SERVER-SIDE ONLY (يستخدم مفتاح الخدمة).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin } from "@/lib/permissions";
import { generateJSON } from "@/lib/ai/gemini";
import { CONTENT_IDEAS_PROMPT, CONTENT_SCRIPT_PROMPT } from "@/lib/ai/prompts";
import {
  CONTENT_KINDS, ITEM_STATUSES, PLAN_STATUSES, PLATFORMS, kindLabel, platformLabel,
  type ContentItem, type ContentPlan, type ContentSuggestion, type ContentKind,
} from "./types";

const KINDS = CONTENT_KINDS.map((k) => k.value) as string[];
const ITEM_STATUS_VALUES = ITEM_STATUSES.map((s) => s.value) as string[];
const PLAN_STATUS_VALUES = PLAN_STATUSES.map((s) => s.value) as string[];
const PLATFORM_VALUES = PLATFORMS.map((p) => p.value);

const str = (v: unknown, max = 20000) => (typeof v === "string" ? v.slice(0, max) : undefined);

// ─── سياق الوصول ─────────────────────────────────────────────────────────────

export type PlanAccess =
  | { ok: true; plan: ContentPlan; canEdit: boolean; isOwner: boolean; actorName: string }
  | { ok: false; res: NextResponse };

const deny = (status: number, error: string): { ok: false; res: NextResponse } => ({
  ok: false,
  res: NextResponse.json({ error }, { status }),
});

/** مستخدم مسجّل: له وصول كامل لخطط منظمته (والسوبر أدمن لكل المنظمات). */
export async function getMemberContext() {
  const user = await getAuthUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("id, name, org_id")
    .eq("id", user.id)
    .single();
  const superAdmin = await isSuperAdmin(user.id);
  return {
    userId: user.id,
    name: (profile?.name as string | null) ?? "",
    orgId: (profile?.org_id as string | null) ?? null,
    superAdmin,
    canAccessOrg: (orgId: string) => superAdmin || profile?.org_id === orgId,
  };
}

export async function accessByMember(planId: string): Promise<PlanAccess> {
  const member = await getMemberContext();
  if (!member) return deny(401, "Unauthorized");
  const { data: plan } = await supabaseAdmin.from("content_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan || !member.canAccessOrg(plan.org_id)) return deny(404, "الخطة غير موجودة");
  return { ok: true, plan: plan as ContentPlan, canEdit: true, isOwner: true, actorName: member.name };
}

/** زائر بالرابط العام: يجب أن تكون المشاركة مفعّلة، والتعديل فقط في وضع «edit». */
export async function accessByToken(token: string): Promise<PlanAccess> {
  if (!token || token.length < 16) return deny(404, "الرابط غير صالح");
  const { data: plan } = await supabaseAdmin
    .from("content_plans")
    .select("*")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (!plan) return deny(404, "الرابط غير صالح أو تم إيقاف مشاركته");
  return { ok: true, plan: plan as ContentPlan, canEdit: plan.share_mode === "edit", isOwner: false, actorName: "زائر الرابط" };
}

/** يخفي حقول المشاركة عن الزائر. */
export function publicPlan(plan: ContentPlan, isOwner: boolean) {
  if (isOwner) return plan;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { share_token, org_id, ...rest } = plan;
  return rest;
}

// ─── القراءة / الكتابة ───────────────────────────────────────────────────────

export async function loadPlanPayload(access: Extract<PlanAccess, { ok: true }>) {
  const { data: items } = await supabaseAdmin
    .from("content_items")
    .select("*")
    .eq("plan_id", access.plan.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return {
    plan: publicPlan(access.plan, access.isOwner),
    items: (items ?? []) as ContentItem[],
    canEdit: access.canEdit,
    isOwner: access.isOwner,
  };
}

/** حقول الخطة القابلة للتعديل. حقول المشاركة للمالك فقط. */
export function sanitizePlanPatch(body: Record<string, unknown>, isOwner: boolean) {
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "audience", "related_product", "tone"] as const) {
    const v = str(body[k], 5000);
    if (v !== undefined) patch[k] = v;
  }
  if (typeof patch.title === "string" && !patch.title.trim()) delete patch.title;
  if (Array.isArray(body.platforms)) {
    patch.platforms = body.platforms.filter((p): p is string => typeof p === "string" && PLATFORM_VALUES.includes(p));
  }
  if (typeof body.status === "string" && PLAN_STATUS_VALUES.includes(body.status)) patch.status = body.status;
  if (isOwner) {
    if (typeof body.share_enabled === "boolean") patch.share_enabled = body.share_enabled;
    if (body.share_mode === "view" || body.share_mode === "edit") patch.share_mode = body.share_mode;
  }
  return patch;
}

export function sanitizeItem(body: Record<string, unknown>) {
  const item: Record<string, unknown> = {};
  for (const k of ["title", "idea", "script", "caption"] as const) {
    const v = str(body[k]);
    if (v !== undefined) item[k] = v;
  }
  if (typeof body.kind === "string" && KINDS.includes(body.kind)) item.kind = body.kind;
  if (typeof body.status === "string" && ITEM_STATUS_VALUES.includes(body.status)) item.status = body.status;
  if (typeof body.platform === "string" && (body.platform === "" || PLATFORM_VALUES.includes(body.platform))) item.platform = body.platform;
  if (body.publish_date === null || body.publish_date === "") item.publish_date = null;
  else if (typeof body.publish_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.publish_date)) item.publish_date = body.publish_date;
  if (body.source === "ai" || body.source === "manual") item.source = body.source;
  if (typeof body.sort_order === "number" && Number.isFinite(body.sort_order)) item.sort_order = Math.trunc(body.sort_order);
  return item;
}

export async function touchPlan(planId: string) {
  await supabaseAdmin.from("content_plans").update({ updated_at: new Date().toISOString() }).eq("id", planId);
}

// ─── الذكاء الاصطناعي ────────────────────────────────────────────────────────

function planContext(plan: ContentPlan) {
  return {
    عنوان_الخطة: plan.title,
    الوصف_والهدف: plan.description || "غير محدد",
    الجمهور_المستهدف: plan.audience || "أصحاب المطاعم والكافيهات والمحلات في السعودية",
    المنتج: plan.related_product || "غير محدد",
    المنصات: plan.platforms?.length ? plan.platforms.map(platformLabel).join("، ") : "غير محدد",
    النبرة: plan.tone || "قريبة وعفوية باللهجة السعودية",
  };
}

export async function generateIdeas(
  plan: ContentPlan,
  existingTitles: string[],
  opts: { kind?: string; count?: number; hint?: string }
): Promise<ContentSuggestion[]> {
  const count = Math.min(Math.max(Number(opts.count) || 5, 1), 10);
  const kind = opts.kind && KINDS.includes(opts.kind) ? (opts.kind as ContentKind) : null;
  const prompt = CONTENT_IDEAS_PROMPT
    .replace("{plan}", JSON.stringify(planContext(plan), null, 2))
    .replace("{count}", String(count))
    .replace("{kind}", kind ? kindLabel(kind) + ` (القيمة: ${kind})` : "نوّع بين الأنواع المتاحة")
    .replace("{hint}", str(opts.hint, 1000)?.trim() || "لا يوجد")
    .replace("{existing}", existingTitles.length ? existingTitles.slice(0, 60).join(" | ") : "لا يوجد");
  const res = await generateJSON<{ ideas: ContentSuggestion[] }>(prompt);
  return (res.ideas ?? [])
    .filter((i) => i && typeof i.title === "string")
    .slice(0, count)
    .map((i) => ({
      kind: (KINDS.includes(i.kind) ? i.kind : kind ?? "video") as ContentKind,
      title: String(i.title ?? ""),
      idea: String(i.idea ?? ""),
      script: String(i.script ?? ""),
      caption: String(i.caption ?? ""),
    }));
}

export async function generateScript(
  plan: ContentPlan,
  item: { kind?: string; title?: string; idea?: string; script?: string },
  instruction?: string
): Promise<{ script: string; caption: string }> {
  const kind = item.kind && KINDS.includes(item.kind) ? item.kind : "video";
  const prompt = CONTENT_SCRIPT_PROMPT
    .replace("{plan}", JSON.stringify(planContext(plan), null, 2))
    .replace("{kind}", kindLabel(kind))
    .replace("{title}", str(item.title, 500) || "بدون عنوان")
    .replace("{idea}", str(item.idea, 3000) || "غير محددة")
    .replace("{current}", str(item.script, 8000)?.trim() || "لا يوجد")
    .replace("{instruction}", str(instruction, 1000)?.trim() || "اكتب أفضل نسخة ممكنة");
  const res = await generateJSON<{ script: string; caption: string }>(prompt);
  return { script: String(res.script ?? ""), caption: String(res.caption ?? "") };
}
