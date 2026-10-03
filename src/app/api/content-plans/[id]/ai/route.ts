import { NextRequest } from "next/server";
import { accessByMember } from "@/lib/content-plans/server";
import { handleAI } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleAI(req, () => accessByMember(id));
}
