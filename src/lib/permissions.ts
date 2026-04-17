import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const permissionCache = new Map<
  string,
  { permissions: Record<string, boolean>; expiresAt: number }
>();
const CACHE_TTL = 60_000;

export async function getAuthUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .single();
  return data?.is_super_admin === true;
}

export async function getUserPermissions(
  userId: string
): Promise<Record<string, boolean>> {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  const { data } = await supabaseAdmin
    .from("user_permissions")
    .select("permission_key, granted")
    .eq("user_id", userId);

  const permissions: Record<string, boolean> = {};
  if (data) {
    for (const row of data) {
      permissions[row.permission_key] = row.granted;
    }
  }

  permissionCache.set(userId, {
    permissions,
    expiresAt: Date.now() + CACHE_TTL,
  });
  return permissions;
}

export async function hasPermission(
  userId: string,
  key: string
): Promise<boolean> {
  if (await isSuperAdmin(userId)) return true;
  const permissions = await getUserPermissions(userId);
  return permissions[key] === true;
}

export function invalidateUserCache(userId: string) {
  permissionCache.delete(userId);
}
