import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;

  const isSelf = user.id === userId;
  if (!isSelf && !(await hasPermission(user.id, "manage_permissions"))) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_permissions")
    .select("permission_key, granted, updated_at")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
