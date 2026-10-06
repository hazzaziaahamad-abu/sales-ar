import { getAuthUser, isSuperAdmin } from "@/lib/permissions";
import { getChallengeProfile, isHuddleManager } from "@/lib/api/challenge-access";

/**
 * صلاحيات التذاكر: أي مستخدم في المنظمة يفتح تذكرة ويشوف الكل ويعلّق.
 * تغيير الحالة/الإسناد/الإغلاق: السوبر أدمن ومدراء المتابعة اليومية، والمسؤول عن التذكرة.
 */
export async function getTicketAccess() {
  const user = await getAuthUser();
  if (!user) return null;
  const profile = await getChallengeProfile(user.id);
  const orgId = profile?.org_id;
  if (!orgId) return null;
  const isManager = (await isSuperAdmin(user.id)) || (await isHuddleManager(user.id, orgId));
  return { userId: user.id, orgId, name: profile?.name ?? null, isManager };
}
