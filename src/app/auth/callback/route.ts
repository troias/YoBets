import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/nrl";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && user) {
      // New user detection: no alert_preferences means first login
      const prefs = await prisma.alertPreferences.findUnique({ where: { userId: user.id }, select: { id: true } }).catch(() => null);
      if (!prefs) {
        // Check for referral code in cookie (set at /register?ref=CODE)
        const refCode = cookieStore.get("pending_ref")?.value;
        if (refCode) {
          const refOwner = await prisma.appConfig.findUnique({ where: { key: `ref_user_${refCode}` } }).catch(() => null);
          if (refOwner?.value) {
            void prisma.appConfig.upsert({
              where: { key: `ref_used_${user.id}` },
              create: { key: `ref_used_${user.id}`, label: "Referred by", value: refOwner.value, updatedAt: new Date() },
              update: {},
            }).catch(() => null);
          }
        }
        return NextResponse.redirect(`${origin}/onboarding`);
      }
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
