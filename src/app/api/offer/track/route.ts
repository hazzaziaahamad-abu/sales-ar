import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function detectDevice(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobile|iphone|android/.test(s)) return "mobile";
  return "desktop";
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ua = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer") || "";
    const page = str(body.page, 40) || "";
    const ref = str(body.ref, 120);

    if (body.type === "lead") {
      // نموذج تواصل — زائر معروف (lead)
      if (!str(body.name, 120) && !str(body.phone, 40)) {
        return NextResponse.json({ ok: false, error: "missing" }, { status: 200 });
      }
      await supabaseAdmin.from("offer_leads").insert({
        name: str(body.name, 120),
        phone: str(body.phone, 40),
        business_type: str(body.businessType, 80),
        page,
        ref,
        note: str(body.note, 500),
      });
    } else {
      const allowedKinds = ["visit", "whatsapp", "call", "quote"];
      const kind = allowedKinds.includes(body.kind) ? body.kind : "visit";
      await supabaseAdmin.from("offer_visits").insert({
        page,
        kind,
        ref,
        referrer: str(body.referrer, 300) || str(referer, 300),
        device: detectDevice(ua),
        user_agent: ua.slice(0, 300) || null,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    // لا نكسر الصفحة أبداً
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
