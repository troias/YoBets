import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/live", "/ev", "/arbitrage", "/nrl", "/settings", "/admin"];

export function middleware(req: NextRequest) {
  const isProtected = protectedRoutes.some((route) => req.nextUrl.pathname.startsWith(route));

  if (!isProtected) return NextResponse.next();

  const hasSession = req.cookies.has("sb-access-token");
  if (!hasSession) {
    const redirect = new URL("/login", req.url);
    redirect.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/live/:path*", "/ev/:path*", "/arbitrage/:path*", "/nrl/:path*", "/settings/:path*", "/admin/:path*"],
};
