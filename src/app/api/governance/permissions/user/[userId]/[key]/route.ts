import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission, invalidateUserCache } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; key: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasPermission(user.id, "manage_permissions"))) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const { userId, key } = await params;
  const body = await req.json();
  const { granted } = body;

  if (typeof granted !== "boolean") {
    return NextResponse.json({ error: "granted must be boolean" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_permissions")
    .upsert(
      {
        user_id: userId,
        permission_key: key,
        granted,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,permission_key" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateUserCache(userId);
  return NextResponse.json(data);
}
