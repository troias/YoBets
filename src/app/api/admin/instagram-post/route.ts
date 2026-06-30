import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/subscription";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yo-bets.vercel.app";
const OG_IMAGE_URL = `${SITE_URL}/opengraph-image`;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caption } = await req.json() as { caption: string };
  if (!caption?.trim()) {
    return NextResponse.json({ error: "Caption required" }, { status: 400 });
  }

  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!igAccountId || !pageToken) {
    return NextResponse.json({ error: "INSTAGRAM_ACCOUNT_ID or FACEBOOK_PAGE_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  // Step 1: create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: OG_IMAGE_URL,
        caption: caption.trim(),
        access_token: pageToken,
      }),
    }
  );

  const container = await containerRes.json() as { id?: string; error?: { message: string } };
  if (!containerRes.ok || !container.id) {
    return NextResponse.json({ error: container.error?.message ?? "Failed to create media container" }, { status: 500 });
  }

  // Step 2: publish
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: pageToken,
      }),
    }
  );

  const published = await publishRes.json() as { id?: string; error?: { message: string } };
  if (!publishRes.ok || !published.id) {
    return NextResponse.json({ error: published.error?.message ?? "Failed to publish" }, { status: 500 });
  }

  return NextResponse.json({ id: published.id });
}
