import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Returns the authenticated user, or null if not logged in. */
export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
