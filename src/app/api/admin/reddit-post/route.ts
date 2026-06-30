import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/subscription";

async function getRedditToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("Reddit credentials not configured");
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "EdgeBoard/1.0",
    },
    body: new URLSearchParams({ grant_type: "password", username, password }),
  });

  const data = await res.json() as { access_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error ?? "Failed to get Reddit token");
  return data.access_token;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { subreddit, title, text } = await req.json() as { subreddit: string; title: string; text: string };
  if (!subreddit || !title || !text) {
    return NextResponse.json({ error: "subreddit, title and text required" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getRedditToken();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "EdgeBoard/1.0",
    },
    body: new URLSearchParams({
      sr: subreddit,
      kind: "self",
      title,
      text,
      resubmit: "true",
    }),
  });

  const data = await res.json() as { success?: boolean; jquery?: Array<Array<unknown>>; error?: string };

  // Reddit returns 200 even on errors — check for error in response
  const errorMsg = data.error ?? (data.jquery?.flat().find((v) => typeof v === "string" && v.includes("error")) as string | undefined);
  if (errorMsg) return NextResponse.json({ error: errorMsg }, { status: 400 });

  return NextResponse.json({ ok: true });
}
