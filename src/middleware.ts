import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

// These paths are called server-to-server and carry their own auth, so they
// must bypass the Supabase-session gate:
//   /api/wa/webhook        — OpenWA gateway, HMAC-signed
//   /api/cron/*            — Supabase pg_cron, guarded by CRON_SECRET
//   /api/render/task-card  — public image, payload HMAC-signed in the token
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/gift",
  "/submit",
  "/offer",
  "/api/offer/track",
  "/api/wa/webhook",
  "/api/cron/",
  "/api/render/task-card",
];

// أقصى مهلة لفحص الجلسة عبر Supabase. لو تأخّر Supabase (مثلاً تأخير بين
// منطقتين) نرجع بدون تعليق الـmiddleware كي لا يسقط الموقع بخطأ 504.
const AUTH_TIMEOUT_MS = 3000;

async function getUserWithTimeout(
  supabase: ReturnType<typeof createMiddlewareClient>["supabase"]
) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)),
    ]);
    return result?.data?.user ?? null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const { supabase, response } = createMiddlewareClient(request);

  // المسارات العامة (صفحة العرض، تسجيل الدخول، الويبهوكس…) لا تحتاج فحص جلسة،
  // ولا يصح أن تنتظر Supabase. الاستثناء الوحيد /login: نفحص الجلسة لتحويل
  // المسجَّل دخوله إلى لوحة التحكم — ومع ذلك بمهلة قصوى حتى لا يتعطّل.
  if (isPublicPath) {
    if (pathname === "/login") {
      const user = await getUserWithTimeout(supabase);
      if (user) {
        const dashUrl = request.nextUrl.clone();
        dashUrl.pathname = "/dashboard";
        return NextResponse.redirect(dashUrl);
      }
    }
    return response;
  }

  // مسار محميّ: افحص الجلسة (مع مهلة). عند غياب المستخدم أو تأخّر Supabase
  // نحوّل لتسجيل الدخول بدل تعليق الطلب.
  const user = await getUserWithTimeout(supabase);
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
