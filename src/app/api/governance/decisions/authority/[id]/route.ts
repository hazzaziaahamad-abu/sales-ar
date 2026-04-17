import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasPermission(user.id, "manage_decisions"))) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { authority_level, notes_ar } = body;

  if (!authority_level || !["rep", "lead", "founder"].includes(authority_level)) {
    return NextResponse.json({ error: "authority_level must be rep, lead, or founder" }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from("decision_authority")
    .select("authority_level")
    .eq("id", id)
    .single();

  if (!current) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  if (current.authority_level !== authority_level) {
    await supabaseAdmin.from("decision_authority_log").insert({
      decision_id: id,
      changed_by: user.id,
      old_level: current.authority_level,
      new_level: authority_level,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("decision_authority")
    .update({
      authority_level,
      notes_ar: notes_ar ?? null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
