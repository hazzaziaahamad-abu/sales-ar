import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function verifySuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_super_admin ? user : null;
}

export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("*, roles(id, name, slug, allowed_pages), organizations(name, name_ar)")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const admin = await verifySuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { email, password, name, org_id, allowed_pages, is_super_admin } = body;

  if (!email || !password || !name || !org_id || !allowed_pages?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Auto-create a role for this user
  const roleSlug = `user_${email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_")}`;
  const { data: role, error: roleError } = await supabaseAdmin
    .from("roles")
    .insert({
      name: name,
      slug: roleSlug,
      org_id,
      allowed_pages,
      is_system: false,
    })
    .select()
    .single();

  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    // Rollback role
    await supabaseAdmin.from("roles").delete().eq("id", role.id);
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Upsert profile (trigger on auth.users may have already created a row)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .upsert({
      id: authData.user.id,
      email,
      name,
      org_id,
      role_id: role.id,
      is_super_admin: is_super_admin || false,
    })
    .select("*, roles(id, name, slug, allowed_pages), organizations(name, name_ar)")
    .single();

  if (profileError) {
    // Rollback
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    await supabaseAdmin.from("roles").delete().eq("id", role.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}
