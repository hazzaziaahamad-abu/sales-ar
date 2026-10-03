import { NextRequest } from "next/server";
import { accessByToken } from "@/lib/content-plans/server";
import { handleAI } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handleAI(req, () => accessByToken(token));
}
