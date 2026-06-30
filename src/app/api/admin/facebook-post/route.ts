import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/subscription";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "Post text required" }, { status: 400 });
  }

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageToken) {
    return NextResponse.json({ error: "Facebook credentials not configured — add FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in Vercel env vars" }, { status: 500 });
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text.trim(), access_token: pageToken }),
  });

  const data = await res.json() as { id?: string; error?: { message: string } };

  if (!res.ok || data.error) {
    return NextResponse.json({ error: data.error?.message ?? "Facebook API error" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
