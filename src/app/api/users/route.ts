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
    .select("*, roles(id, name, slug), organizations(name, name_ar)")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const admin = await verifySuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const { email, password, name, org_id, role_id, is_super_admin } = body;

  if (!email || !password || !name || !org_id || !role_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  // Create profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .insert({
      id: authData.user.id,
      email,
      name,
      org_id,
      role_id,
      is_super_admin: is_super_admin || false,
    })
    .select("*, roles(id, name, slug), organizations(name, name_ar)")
    .single();

  if (profileError) {
    // Rollback: delete the auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}
