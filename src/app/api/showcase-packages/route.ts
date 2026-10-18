import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, hasPermission } from "@/lib/permissions";
import { DEFAULT_SHOWCASE_PACKAGES, SHOWCASE_EDIT_PERMISSION, sanitizePackages } from "@/lib/showcase";

export const runtime = "nodejs";

/** المستخدم مسجّل + عضو في المنظمة المطلوبة (أساسية، إضافية، أو سوبر أدمن). */
async function getShowcaseAccess(orgId: string | null) {
  const user = await getAuthUser();
  if (!user) return { status: 401 as const };
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("org_id, extra_org_ids, is_super_admin")
    .eq("id", user.id)
    .single();
  if (!profile) return { status: 401 as const };
  const org = orgId || profile.org_id;
  const member =
    profile.is_super_admin === true ||
    org === profile.org_id ||
    (Array.isArray(profile.extra_org_ids) && profile.extra_org_ids.includes(org));
  if (!org || !member) return { status: 403 as const };
  return { status: 200 as const, userId: user.id, orgId: org as string };
}

/** GET /api/showcase-packages?org=… → الباقات + هل المستخدم يقدر يعدّل. */
export async function GET(req: NextRequest) {
  const access = await getShowcaseAccess(req.nextUrl.searchParams.get("org"));
  if (access.status !== 200) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  const [{ data, error }, canEdit] = await Promise.all([
    supabaseAdmin.from("showcase_packages").select("packages").eq("org_id", access.orgId).maybeSingle(),
    hasPermission(access.userId, SHOWCASE_EDIT_PERMISSION),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const packages = Array.isArray(data?.packages) ? data.packages : DEFAULT_SHOWCASE_PACKAGES;
  return NextResponse.json({ packages, canEdit, orgId: access.orgId });
}

/** PUT /api/showcase-packages → حفظ القائمة كاملة (للمدير فقط). */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const access = await getShowcaseAccess(typeof body.org_id === "string" ? body.org_id : null);
  if (access.status !== 200) return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  if (!(await hasPermission(access.userId, SHOWCASE_EDIT_PERMISSION))) {
    return NextResponse.json({ error: "ما عندك صلاحية تعديل الباقات" }, { status: 403 });
  }

  const packages = sanitizePackages(body.packages);
  if (!packages) return NextResponse.json({ error: "بيانات الباقات غير صالحة (كل باقة تحتاج اسم)" }, { status: 400 });

  const { error } = await supabaseAdmin.from("showcase_packages").upsert(
    { org_id: access.orgId, packages, updated_by: access.userId, updated_at: new Date().toISOString() },
    { onConflict: "org_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ packages });
}
