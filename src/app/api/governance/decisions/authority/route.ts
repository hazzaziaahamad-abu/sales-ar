import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("decision_authority")
    .select("*")
    .order("category")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
