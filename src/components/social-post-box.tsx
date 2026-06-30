"use client";

import { useState } from "react";

const TEMPLATES = [
  {
    label: "Arb finder",
    text: `Found a live NRL arbitrage opportunity across 11 Australian bookmakers — guaranteed profit regardless of result.\n\nFree tool → yo-bets.vercel.app`,
  },
  {
    label: "EV finder",
    text: `NRL value bets right now — EV calculator comparing fair price vs offered price across Sportsbet, TAB, Ladbrokes + 8 more.\n\nFree → yo-bets.vercel.app`,
  },
  {
    label: "General launch",
    text: `Built a free NRL odds tool:\n→ All 11 Australian bookmakers side by side\n→ Arb finder (guaranteed profit when books disagree)\n→ EV calculator with Kelly stakes\n→ Line movement + bet tracker\n\nyo-bets.vercel.app`,
  },
];

type PostStatus = "idle" | "posting" | "success" | "error";

async function postTo(endpoint: string, text: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json() as { id?: string; error?: string };
    if (!res.ok) return { ok: false, message: data.error ?? "Failed to post" };
    return { ok: true, message: `Posted! ID: ${data.id}` };
  } catch {
    return { ok: false, message: "Network error" };
  }
}

export function SocialPostBox({
  hasTwitter,
  hasFacebook,
}: {
  hasTwitter: boolean;
  hasFacebook: boolean;
}) {
  const [text, setText] = useState("");
  const [twitterStatus, setTwitterStatus] = useState<PostStatus>("idle");
  const [facebookStatus, setFacebookStatus] = useState<PostStatus>("idle");
  const [twitterMsg, setTwitterMsg] = useState("");
  const [facebookMsg, setFacebookMsg] = useState("");

  const twitterRemaining = 280 - text.length;

  async function postToTwitter() {
    if (!text.trim() || twitterStatus === "posting") return;
    setTwitterStatus("posting");
    setTwitterMsg("");
    const result = await postTo("/api/admin/tweet", text);
    setTwitterStatus(result.ok ? "success" : "error");
    setTwitterMsg(result.message);
    if (result.ok) setText("");
  }

  async function postToFacebook() {
    if (!text.trim() || facebookStatus === "posting") return;
    setFacebookStatus("posting");
    setFacebookMsg("");
    const result = await postTo("/api/admin/facebook-post", text);
    setFacebookStatus(result.ok ? "success" : "error");
    setFacebookMsg(result.message);
    if (result.ok) setText("");
  }

  return (
    <div className="space-y-3">
      {/* Templates */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setText(t.text)}
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Compose */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Compose post…"
        rows={5}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 resize-none"
      />

      {/* Post buttons */}
      <div className="flex flex-wrap gap-2 items-center">
        {hasTwitter ? (
          <button
            type="button"
            onClick={postToTwitter}
            disabled={!text.trim() || twitterRemaining < 0 || twitterStatus === "posting"}
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {twitterStatus === "posting" ? "Posting…" : "Post to X / Twitter"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Twitter: add TWITTER_* env vars to enable</span>
        )}

        {hasFacebook ? (
          <button
            type="button"
            onClick={postToFacebook}
            disabled={!text.trim() || facebookStatus === "posting"}
            className="rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166fe5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {facebookStatus === "posting" ? "Posting…" : "Post to Facebook Page"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Facebook: add FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN to enable</span>
        )}

        {hasTwitter && (
          <span className={`ml-auto text-xs ${twitterRemaining < 20 ? "text-red-400" : "text-zinc-600"}`}>
            {twitterRemaining} chars (Twitter limit)
          </span>
        )}
      </div>

      {twitterMsg && (
        <p className={`text-xs ${twitterStatus === "success" ? "text-green-400" : "text-red-400"}`}>
          Twitter: {twitterMsg}
        </p>
      )}
      {facebookMsg && (
        <p className={`text-xs ${facebookStatus === "success" ? "text-green-400" : "text-red-400"}`}>
          Facebook: {facebookMsg}
        </p>
      )}

      <p className="text-xs text-zinc-700">Reddit: post manually — automated Reddit posts get accounts flagged by mods.</p>
    </div>
  );
}
