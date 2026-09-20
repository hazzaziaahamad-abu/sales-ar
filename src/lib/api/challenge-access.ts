import { getAuthUser, isSuperAdmin, hasPermission } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ChallengeUserProfile = {
  id: string;
  name: string | null;
  org_id: string | null;
  is_super_admin: boolean | null;
};

/** يجلب ملف المستخدم (الاسم/المنظمة) عبر مفتاح الخدمة. */
export async function getChallengeProfile(userId: string): Promise<ChallengeUserProfile | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("id, name, org_id, is_super_admin")
    .eq("id", userId)
    .single();
  return (data as ChallengeUserProfile) ?? null;
}

/**
 * سياق المدير: المستخدم مسجّل + مخوّل لرؤية التحديات (سوبر أدمن أو صلاحية challenges_manage).
 * يُستخدم لحراسة جميع مسارات القراءة/المعالجة الخاصة بالمدير.
 */
export async function getManagerContext(): Promise<
  | { ok: true; user: { id: string }; profile: ChallengeUserProfile | null }
  | { ok: false; status: 401 | 403 }
> {
  const user = await getAuthUser();
  if (!user) return { ok: false, status: 401 };
  const allowed = (await isSuperAdmin(user.id)) || (await hasPermission(user.id, "challenges_manage"));
  if (!allowed) return { ok: false, status: 403 };
  const profile = await getChallengeProfile(user.id);
  return { ok: true, user: { id: user.id }, profile };
}
