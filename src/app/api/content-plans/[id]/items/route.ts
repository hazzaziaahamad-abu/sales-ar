import { NextRequest } from "next/server";
import { accessByMember } from "@/lib/content-plans/server";
import { handleItems } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

async function handler(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handleItems(req, () => accessByMember(id));
}

export { handler as POST, handler as PATCH, handler as DELETE };
