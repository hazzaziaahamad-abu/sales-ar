import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission, invalidateUserCache } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasPermission(user.id, "manage_permissions"))) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json();
  const { role_slug } = body;

  if (!role_slug) {
    return NextResponse.json({ error: "role_slug is required" }, { status: 400 });
  }

  const { data: template, error: tErr } = await supabaseAdmin
    .from("role_templates")
    .select("permission_key, granted")
    .eq("role_slug", role_slug);

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!template || template.length === 0) {
    return NextResponse.json({ error: "قالب غير موجود" }, { status: 404 });
  }

  const rows = template.map((t) => ({
    user_id: userId,
    permission_key: t.permission_key,
    granted: t.granted,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from("user_permissions")
    .upsert(rows, { onConflict: "user_id,permission_key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateUserCache(userId);
  return NextResponse.json({ success: true, applied: role_slug });
}
