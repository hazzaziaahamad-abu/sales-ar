// «مكتب المحتوى» — مساعدات الخادم (service role). لا تُستورد في مكونات العميل.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin } from "@/lib/permissions";
import { getChallengeProfile, isHuddleManager } from "@/lib/api/challenge-access";
import type { DeskPerson } from "./types";

export const DESK_SLUG = "content-desk";

export interface DeskAccess {
  me: { id: string; name: string; isManager: boolean };
  orgId: string;
  /** صاحب المكتب المعروض */
  owner: DeskPerson;
}

/**
 * المستخدم + صاحب المكتب. ?as= للسوبر أدمن ومدراء المتابعة اليومية (لموظف من نفس المنشأة)،
 * والمدير يقدر يعدّل على مكتب الأخصائي (يضيف خطة ويحدد الأهداف).
 */
export async function getDeskAccess(asUserId?: string | null): Promise<DeskAccess | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const profile = await getChallengeProfile(user.id);
  if (!profile?.org_id) return null;
  const isManager = (await isSuperAdmin(user.id)) || (await isHuddleManager(user.id, profile.org_id));
  const me = { id: user.id, name: profile.name ?? "", isManager };
  if (asUserId && isManager && asUserId !== user.id) {
    const other = await getChallengeProfile(asUserId);
    if (other?.org_id === profile.org_id) {
      return { me, orgId: profile.org_id, owner: { id: other.id, name: other.name ?? "" } };
    }
  }
  return { me, orgId: profile.org_id, owner: { id: user.id, name: me.name } };
}

/** أخصائيو المحتوى: موظفو المنشأة النشطون اللي دورهم فيه صفحة «مكتب المحتوى». */
export async function deskPeople(orgId: string): Promise<DeskPerson[]> {
  const { data: roles } = await supabaseAdmin.from("roles").select("id").contains("allowed_pages", [DESK_SLUG]);
  const roleIds = (roles ?? []).map((r) => r.id as string);
  if (!roleIds.length) return [];
  const { data } = await supabaseAdmin.from("user_profiles").select("id, name")
    .eq("org_id", orgId).eq("is_active", true).eq("is_super_admin", false).in("role_id", roleIds).order("name");
  return (data ?? []).map((u) => ({ id: u.id as string, name: (u.name as string) ?? "" }));
}
