import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/permissions";
import { getChallengeProfile } from "@/lib/api/challenge-access";
import { canUseIdeas } from "@/lib/ideas";

/** صلاحية «البذور»: المدير (السوبر أدمن) ومنال فقط. يرجّع NextResponse عند الرفض. */
export async function getIdeasAccess(): Promise<{ userId: string; orgId: string } | NextResponse> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getChallengeProfile(user.id);
  if (!profile?.org_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUseIdeas({ name: profile.name, isSuperAdmin: profile.is_super_admin })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId: user.id, orgId: profile.org_id };
}
