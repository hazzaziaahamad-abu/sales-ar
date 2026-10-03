import { NextRequest } from "next/server";
import { accessByToken } from "@/lib/content-plans/server";
import { handleSuggestions } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handleSuggestions(req, () => accessByToken(token));
}
