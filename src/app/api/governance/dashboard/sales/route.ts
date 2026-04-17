import { NextResponse } from "next/server";
import { getAuthUser, hasPermission, isSuperAdmin } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isSuperAdmin(user.id);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  let query = supabaseAdmin.from("deals").select("*");

  if (admin) {
    return NextResponse.json(
      (await query.order("created_at", { ascending: false })).data || []
    );
  }

  const canViewTeamCurrent = await hasPermission(user.id, "view_team_current");
  const canViewTeamHistory = await hasPermission(user.id, "view_team_history");
  const canViewOwnCurrent = await hasPermission(user.id, "view_own_current");
  const canViewOwnHistory = await hasPermission(user.id, "view_own_history");
  const canViewOwnCompleted = await hasPermission(user.id, "view_own_completed");
  const canViewOwnPendingOld = await hasPermission(user.id, "view_own_pending_old");

  if (canViewTeamHistory) {
    return NextResponse.json(
      (await query.order("created_at", { ascending: false })).data || []
    );
  }

  if (canViewTeamCurrent) {
    query = query.gte("deal_date", monthStartStr);
    return NextResponse.json(
      (await query.order("created_at", { ascending: false })).data || []
    );
  }

  const { data: allDeals } = await supabaseAdmin
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });

  const filtered = (allDeals || []).filter((d) => {
    const isOwn = d.assigned_rep_id === user.id;
    if (!isOwn) return false;

    const dealDate = d.deal_date || d.created_at;
    const isCurrentMonth = dealDate >= monthStartStr;

    if (canViewOwnHistory) return true;

    if (isCurrentMonth) {
      if (d.stage === "مكتملة") return canViewOwnCompleted;
      return canViewOwnCurrent;
    }

    if (d.stage !== "مكتملة") return canViewOwnPendingOld;

    return false;
  });

  return NextResponse.json(filtered);
}
