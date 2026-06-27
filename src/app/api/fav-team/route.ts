import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const team    = searchParams.get("team") ?? "";
  const clear   = searchParams.get("clear") === "1";
  const back    = searchParams.get("back") ?? "/nrl";

  const redirect = NextResponse.redirect(new URL(back, req.url));

  if (clear) {
    redirect.cookies.set("fav_team", "", { path: "/", maxAge: 0 });
  } else if (team) {
    redirect.cookies.set("fav_team", team, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  }

  return redirect;
}
