import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

const protectedRoutes = [
  "/dashboard",
  "/live",
  "/ev",
  "/arbitrage",
  "/settings",
  "/admin",
];

export async function middleware(req: NextRequest) {
  const { supabase, supabaseResponse } = createClient(req);

  const isProtected = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  if (isProtected) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const redirect = new URL("/login", req.url);
      redirect.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(redirect);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/live/:path*",
    "/ev/:path*",
    "/arbitrage/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
