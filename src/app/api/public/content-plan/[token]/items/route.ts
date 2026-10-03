import { NextRequest } from "next/server";
import { accessByToken } from "@/lib/content-plans/server";
import { handleItems } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };

async function handler(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  return handleItems(req, () => accessByToken(token));
}

export { handler as POST, handler as PATCH, handler as DELETE };
