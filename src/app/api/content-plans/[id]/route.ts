import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accessByMember } from "@/lib/content-plans/server";
import { handleGetPlan, handlePatchPlan } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleGetPlan(() => accessByMember(id));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handlePatchPlan(req, () => accessByMember(id));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const access = await accessByMember(id);
  if (!access.ok) return access.res;
  const { error } = await supabaseAdmin.from("content_plans").delete().eq("id", access.plan.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
