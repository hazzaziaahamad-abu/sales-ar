// معالجات مسارات خطة المحتوى — نفس المنطق لمسار العضو (/api/content-plans/[id]) ومسار الرابط العام
// (/api/public/content-plan/[token])، والفرق فقط في طريقة الحصول على صلاحية الوصول.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  type PlanAccess, loadPlanPayload, sanitizePlanPatch, sanitizeItem, touchPlan,
  publicPlan, generateIdeas, generateScript,
} from "./server";

type Resolver = () => Promise<PlanAccess>;
const readOnly = () => NextResponse.json({ error: "هذا الرابط للعرض فقط" }, { status: 403 });
const body = async (req: NextRequest) => ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

export async function handleGetPlan(resolve: Resolver) {
  const access = await resolve();
  if (!access.ok) return access.res;
  return NextResponse.json(await loadPlanPayload(access), { headers: { "Cache-Control": "no-store" } });
}

export async function handlePatchPlan(req: NextRequest, resolve: Resolver) {
  const access = await resolve();
  if (!access.ok) return access.res;
  if (!access.canEdit) return readOnly();
  const b = await body(req);
  const patch = sanitizePlanPatch(b, access.isOwner);
  if (access.isOwner && b.regenerate_token === true) {
    patch.share_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  const { data, error } = await supabaseAdmin
    .from("content_plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", access.plan.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: publicPlan(data, access.isOwner) });
}

export async function handleItems(req: NextRequest, resolve: Resolver) {
  const access = await resolve();
  if (!access.ok) return access.res;
  if (!access.canEdit) return readOnly();
  const planId = access.plan.id;

  if (req.method === "POST") {
    const b = await body(req);
    // إضافة عنصر واحد أو عدة عناصر (اقتراحات الـAI) دفعة واحدة.
    const list = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]) : [b];
    const { data: last } = await supabaseAdmin
      .from("content_items").select("sort_order").eq("plan_id", planId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    let order = (last?.sort_order ?? -1) + 1;
    const rows = list.slice(0, 20).map((it) => ({
      ...sanitizeItem(it),
      plan_id: planId,
      sort_order: order++,
      updated_by_name: access.actorName,
    }));
    const { data, error } = await supabaseAdmin.from("content_items").insert(rows).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // عناصر مصدرها اقتراح محفوظ → نعلّم الاقتراح «أُضيف»
    const suggestionIds = list.slice(0, 20).map((it) => it.suggestion_id).filter((x): x is string => typeof x === "string" && !!x);
    if (suggestionIds.length) {
      await supabaseAdmin.from("content_suggestions").update({ added: true }).eq("plan_id", planId).in("id", suggestionIds);
    }
    await touchPlan(planId);
    return NextResponse.json({ items: data ?? [] });
  }

  if (req.method === "PATCH") {
    const b = await body(req);
    const itemId = String(b.id ?? "");
    if (!itemId) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("content_items")
      .update({ ...sanitizeItem(b), updated_by_name: access.actorName, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("plan_id", planId)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });
    await touchPlan(planId);
    return NextResponse.json({ item: data });
  }

  if (req.method === "DELETE") {
    const itemId = req.nextUrl.searchParams.get("id") || "";
    if (!itemId) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    const { error } = await supabaseAdmin.from("content_items").delete().eq("id", itemId).eq("plan_id", planId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await touchPlan(planId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

/** POST { mode: "ideas", kind?, count?, hint? } | { mode: "script", item: {...}, instruction? } */
export async function handleAI(req: NextRequest, resolve: Resolver) {
  const access = await resolve();
  if (!access.ok) return access.res;
  if (!access.canEdit) return readOnly();
  const b = await body(req);
  try {
    if (b.mode === "script") {
      const item = (b.item ?? {}) as Record<string, string>;
      const result = await generateScript(access.plan, item, typeof b.instruction === "string" ? b.instruction : undefined);
      return NextResponse.json(result);
    }
    // لا نكرر عناوين العناصر ولا الاقتراحات السابقة
    const [{ data: existing }, { data: previous }] = await Promise.all([
      supabaseAdmin.from("content_items").select("title").eq("plan_id", access.plan.id),
      supabaseAdmin.from("content_suggestions").select("title").eq("plan_id", access.plan.id)
        .order("created_at", { ascending: false }).limit(60),
    ]);
    const hint = typeof b.hint === "string" ? b.hint.slice(0, 1000) : "";
    const ideas = await generateIdeas(
      access.plan,
      [...(existing ?? []), ...(previous ?? [])].map((e) => e.title).filter(Boolean),
      { kind: typeof b.kind === "string" ? b.kind : undefined, count: Number(b.count), hint }
    );
    if (!ideas.length) return NextResponse.json({ suggestions: [] });
    const { data: saved, error } = await supabaseAdmin
      .from("content_suggestions")
      .insert(ideas.map((i) => ({ ...i, plan_id: access.plan.id, hint })))
      .select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ suggestions: saved ?? [] });
  } catch (e) {
    console.error("content-plan AI error:", e);
    return NextResponse.json({ error: "تعذّر التوليد بالذكاء الاصطناعي، حاول مرة أخرى" }, { status: 502 });
  }
}

/** DELETE ?id=<id> يتجاهل اقتراحاً، أو ?scope=added|all لمسح المضافة/الكل. */
export async function handleSuggestions(req: NextRequest, resolve: Resolver) {
  const access = await resolve();
  if (!access.ok) return access.res;
  if (!access.canEdit) return readOnly();
  if (req.method !== "DELETE") return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  const id = req.nextUrl.searchParams.get("id");
  const scope = req.nextUrl.searchParams.get("scope");
  let q = supabaseAdmin.from("content_suggestions").delete().eq("plan_id", access.plan.id);
  if (id) q = q.eq("id", id);
  else if (scope === "added") q = q.eq("added", true);
  else if (scope !== "all") return NextResponse.json({ error: "id أو scope مطلوب" }, { status: 400 });
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
