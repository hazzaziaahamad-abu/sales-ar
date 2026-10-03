import { NextRequest } from "next/server";
import { accessByToken } from "@/lib/content-plans/server";
import { handleGetPlan, handlePatchPlan } from "@/lib/content-plans/handlers";

// رابط عام لخطة المحتوى (بدون تسجيل دخول) — محروس بـ share_token + share_enabled،
// والكتابة فقط عند share_mode = edit.
export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return handleGetPlan(() => accessByToken(token));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return handlePatchPlan(req, () => accessByToken(token));
}
