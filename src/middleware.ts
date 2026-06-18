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
  "/api/wa/webhook",
  "/api/cron/",
  "/api/render/task-card",
];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;

  // Refresh session (important for token rotation)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Not logged in → redirect to login (unless already on a public path)
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Logged in → redirect away from login
  if (user && pathname === "/login") {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
