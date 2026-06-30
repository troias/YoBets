import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/subscription";
import { TwitterApi } from "twitter-api-v2";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "Tweet text required" }, { status: 400 });
  }
  if (text.length > 280) {
    return NextResponse.json({ error: "Tweet exceeds 280 characters" }, { status: 400 });
  }

  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return NextResponse.json({ error: "Twitter API credentials not configured — add them in Admin → App Config" }, { status: 500 });
  }

  const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });

  const tweet = await client.v2.tweet(text.trim());
  return NextResponse.json({ id: tweet.data.id, text: tweet.data.text });
}
