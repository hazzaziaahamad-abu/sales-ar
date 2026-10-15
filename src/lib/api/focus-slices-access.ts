import { NextResponse } from "next/server";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import type { SliceSpace } from "@/lib/focus-slices";

/**
 * صلاحية «الشرائح»: كل مستخدم يدير شرائحه هو فقط.
 * مساحة «العمل الوظيفي» خاصة بالسوبر أدمن.
 */
export async function getSliceAccess(space: SliceSpace): Promise<{ userId: string; orgId: string } | NextResponse> {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (space === "work" && !(await isSuperAdmin(access.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { userId: access.userId, orgId: access.orgId };
}
