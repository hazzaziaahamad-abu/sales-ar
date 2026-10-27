// منطق «التسويق بالمحتوى» على الخادم — يستخدمه مسار المستخدم المسجّل ومسار الرابط العام معاً.
// SERVER-SIDE ONLY (يستخدم مفتاح الخدمة).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin } from "@/lib/permissions";
import { generateJSON } from "@/lib/ai/gemini";
import { CONTENT_IDEAS_PROMPT, CONTENT_SCRIPT_PROMPT } from "@/lib/ai/prompts";
import {
  CONTENT_KINDS, ITEM_STATUSES, PLAN_STATUSES, PLATFORMS, kindLabel, platformLabel, orgContentProfile,
  defaultStepTitles, makeStep, planTypeOf,
  type ContentItem, type ContentPlan, type ContentSuggestion, type ContentKind, type TimelineRow, type ContentStep,
} from "./types";
import { hookLibraryKey, sampleHooks } from "./hooks";

const KINDS = CONTENT_KINDS.map((k) => k.value) as string[];
const ITEM_STATUS_VALUES = ITEM_STATUSES.map((s) => s.value) as string[];
const PLAN_STATUS_VALUES = PLAN_STATUSES.map((s) => s.value) as string[];
const PLATFORM_VALUES = PLATFORMS.map((p) => p.value);

const str = (v: unknown, max = 20000) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** يطبّع تايم لاين الفيديو (من المستخدم أو من الـAI). */
export function cleanTimeline(v: unknown): TimelineRow[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    return {
      time: String(row.time ?? "").slice(0, 50),
      shot: String(row.shot ?? "").slice(0, 2000),
      voice: String(row.voice ?? "").slice(0, 2000),
      text: String(row.text ?? "").slice(0, 1000),
    };
  });
}

export function cleanFocusPoints(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map((x) => String(x ?? "").slice(0, 500));
}

/** يطبّع مراحل التنفيذ القادمة من الواجهة (بدون ختم وقت/اسم الإكمال — هذا يتم في stampSteps). */
export function cleanSteps(v: unknown): ContentStep[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.slice(0, 40) : makeStep("").id;
    return {
      id,
      title: String(row.title ?? "").slice(0, 300),
      note: String(row.note ?? "").slice(0, 2000),
      done: row.done === true,
      done_at: typeof row.done_at === "string" ? row.done_at : null,
      done_by: typeof row.done_by === "string" ? row.done_by.slice(0, 200) : null,
    };
  });
}

/**
 * يختم وقت واسم الإكمال على الخادم: المرحلة المكتملة سابقاً تحتفظ بوقتها ومن أكملها،
 * والمكتملة الآن تأخذ الوقت الحالي واسم المنفّذ، وغير المكتملة تُمسح بياناتها.
 */
export function stampSteps(next: ContentStep[], prev: ContentStep[] | null | undefined, actor: string): ContentStep[] {
  const before = new Map((prev ?? []).map((s) => [s.id, s]));
  const now = new Date().toISOString();
  return next.map((s) => {
    if (!s.done) return { ...s, done_at: null, done_by: null };
    const old = before.get(s.id);
    if (old?.done && old.done_at) return { ...s, done_at: old.done_at, done_by: old.done_by };
    return { ...s, done_at: now, done_by: actor || null };
  });
}

export function cleanStepTemplate(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim().slice(0, 300)).filter(Boolean).slice(0, 40);
}

/** مراحل افتراضية لمحتوى جديد حسب قالب الخطة ونوع المحتوى. */
export function initialSteps(plan: ContentPlan, kind: string): ContentStep[] {
  return defaultStepTitles(planTypeOf(plan), kind, plan.step_template).map(makeStep);
}

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
  // الاقتراحات للي يقدر يعدّل فقط (زائر العرض ما يحتاجها)
  const { data: suggestions } = access.canEdit
    ? await supabaseAdmin
        .from("content_suggestions")
        .select("*")
        .eq("plan_id", access.plan.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  return {
    plan: publicPlan(access.plan, access.isOwner),
    hookLibrary: hookLibraryKey(access.plan.org_id),
    items: (items ?? []) as ContentItem[],
    suggestions: suggestions ?? [],
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
  if (body.plan_type === "creation" || body.plan_type === "publishing") patch.plan_type = body.plan_type;
  if (Array.isArray(body.step_template)) patch.step_template = cleanStepTemplate(body.step_template);
  if (isOwner) {
    if (typeof body.share_enabled === "boolean") patch.share_enabled = body.share_enabled;
    if (body.share_mode === "view" || body.share_mode === "edit") patch.share_mode = body.share_mode;
  }
  return patch;
}

export function sanitizeItem(body: Record<string, unknown>) {
  const item: Record<string, unknown> = {};
  for (const k of ["title", "hook", "idea", "script", "caption"] as const) {
    const v = str(body[k]);
    if (v !== undefined) item[k] = v;
  }
  if (Array.isArray(body.timeline)) item.timeline = cleanTimeline(body.timeline);
  if (Array.isArray(body.focus_points)) item.focus_points = cleanFocusPoints(body.focus_points);
  if (Array.isArray(body.steps)) item.steps = cleanSteps(body.steps);
  if (typeof body.publish_time === "string") item.publish_time = /^\d{2}:\d{2}$/.test(body.publish_time) ? body.publish_time : "";
  if (typeof body.post_url === "string") item.post_url = body.post_url.trim().slice(0, 1000);
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
    الجمهور_المستهدف: plan.audience || orgContentProfile(plan.org_id).audience,
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
    .replace("{business}", orgContentProfile(plan.org_id).business)
    .replace("{plan}", JSON.stringify(planContext(plan), null, 2))
    .replace("{count}", String(count))
    .replace("{kind}", kind ? kindLabel(kind) + ` (القيمة: ${kind})` : "نوّع بين الأنواع المتاحة")
    .replace("{hint}", str(opts.hint, 1000)?.trim() || "لا يوجد")
    .replace("{hooks}", sampleHooks(plan.org_id).map((h) => "- " + h).join("\n"))
    .replace("{existing}", existingTitles.length ? existingTitles.slice(0, 60).join(" | ") : "لا يوجد");
  const res = await generateJSON<{ ideas: ContentSuggestion[] }>(prompt);
  return (res.ideas ?? [])
    .filter((i) => i && typeof i.title === "string")
    .slice(0, count)
    .map((i) => ({
      kind: (KINDS.includes(i.kind) ? i.kind : kind ?? "video") as ContentKind,
      title: String(i.title ?? ""),
      hook: String(i.hook ?? "").slice(0, 500),
      idea: String(i.idea ?? ""),
      script: String(i.script ?? ""),
      caption: String(i.caption ?? ""),
      timeline: cleanTimeline(i.timeline),
      focus_points: cleanFocusPoints(i.focus_points),
    }));
}

export async function generateScript(
  plan: ContentPlan,
  item: { kind?: string; title?: string; hook?: string; idea?: string; script?: string },
  instruction?: string
): Promise<{ hook: string; script: string; caption: string; timeline: TimelineRow[]; focus_points: string[] }> {
  const kind = item.kind && KINDS.includes(item.kind) ? item.kind : "video";
  const prompt = CONTENT_SCRIPT_PROMPT
    .replace("{business}", orgContentProfile(plan.org_id).business)
    .replace("{plan}", JSON.stringify(planContext(plan), null, 2))
    .replace("{kind}", kindLabel(kind))
    .replace("{title}", str(item.title, 500) || "بدون عنوان")
    .replace("{hook}", str(item.hook, 500)?.trim() || "غير محدد — اختر هوك قوي مناسب")
    .replace("{hooks}", sampleHooks(plan.org_id, 10).map((h) => "- " + h).join("\n"))
    .replace("{idea}", str(item.idea, 3000) || "غير محددة")
    .replace("{current}", str(item.script, 8000)?.trim() || "لا يوجد")
    .replace("{instruction}", str(instruction, 1000)?.trim() || "اكتب أفضل نسخة ممكنة");
  const res = await generateJSON<{ hook?: string; script: string; caption: string; timeline?: unknown; focus_points?: unknown }>(prompt);
  return {
    hook: String(res.hook ?? "").slice(0, 500),
    script: String(res.script ?? ""),
    caption: String(res.caption ?? ""),
    timeline: cleanTimeline(res.timeline),
    focus_points: cleanFocusPoints(res.focus_points),
  };
}
