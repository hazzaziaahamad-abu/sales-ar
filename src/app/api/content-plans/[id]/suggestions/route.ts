import { NextRequest } from "next/server";
import { accessByMember } from "@/lib/content-plans/server";
import { handleSuggestions } from "@/lib/content-plans/handlers";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleSuggestions(req, () => accessByMember(id));
}
