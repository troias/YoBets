import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/subscription";

const SYSTEM_PROMPT = `You are a social media marketing expert for EdgeBoard, an Australian NRL sports betting analytics app.
EdgeBoard is free to use and compares odds across 11 Australian bookmakers (Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch, PlayUp).
Key features: odds board, arb finder (guaranteed profit when books disagree), EV calculator, line movement tracker, bet tracker with P&L and ROI.
Pro plan: $19 AUD/month or $99/year — adds push/email/SMS alerts for arbs and EV bets.
URL: yo-bets.vercel.app
Tone: knowledgeable, genuine, not spammy. Speak to sharp bettors who understand value.`;

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  twitter: "Write a tweet under 240 characters. Use line breaks for readability. Include the URL. No hashtags unless very relevant. Be punchy.",
  instagram: "Write an Instagram caption. 3-5 short punchy paragraphs. Use line breaks. End with a call to action and the URL. Include 10-15 relevant hashtags on the last line (e.g. #NRL #sportsbetting #valuebets #arbitrage #Australia).",
  facebook: "Write a Facebook post. Conversational, 2-4 paragraphs. Include the URL. Explain the benefit clearly for someone who hasn't heard of the app.",
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, platform } = await req.json() as { topic: string; platform: string };

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  const platformInstr = PLATFORM_INSTRUCTIONS[platform] ?? PLATFORM_INSTRUCTIONS.twitter;
  const userPrompt = topic?.trim()
    ? `Write a ${platform} post about: ${topic}. ${platformInstr}`
    : `Write a ${platform} post promoting EdgeBoard. ${platformInstr}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: { message: string } };
    return NextResponse.json({ error: err.error?.message ?? "Groq API error" }, { status: 500 });
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const caption = data.choices[0]?.message?.content ?? "";

  return NextResponse.json({ caption });
}
