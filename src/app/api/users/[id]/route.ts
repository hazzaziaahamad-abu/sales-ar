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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, email, org_id, role_id, is_super_admin } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (org_id !== undefined) updates.org_id = org_id;
  if (role_id !== undefined) updates.role_id = role_id;
  if (is_super_admin !== undefined) updates.is_super_admin = is_super_admin;

  // Update auth email if changed
  if (email) {
    await supabaseAdmin.auth.admin.updateUserById(id, { email });
  }

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .update(updates)
    .eq("id", id)
    .select("*, roles(id, name, slug), organizations(name, name_ar)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;

  // Prevent deleting yourself
  if (id === admin.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Delete auth user (cascades to user_profiles)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
