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

async function postTo(
  endpoint: string,
  payload: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  hasInstagram,
}: {
  hasTwitter: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
}) {
  const [text, setText] = useState("");
  const [statuses, setStatuses] = useState<Record<string, PostStatus>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  const twitterRemaining = 280 - text.length;

  async function postVia(key: string, endpoint: string, payload: Record<string, string>) {
    if (!text.trim() || statuses[key] === "posting") return;
    setStatuses((s) => ({ ...s, [key]: "posting" }));
    setMessages((m) => ({ ...m, [key]: "" }));
    const result = await postTo(endpoint, payload);
    setStatuses((s) => ({ ...s, [key]: result.ok ? "success" : "error" }));
    setMessages((m) => ({ ...m, [key]: result.message }));
    if (result.ok) setText("");
  }

  const platforms = [
    {
      key: "twitter",
      enabled: hasTwitter,
      label: statuses.twitter === "posting" ? "Posting…" : "Post to X / Twitter",
      className: "bg-zinc-900 border border-zinc-700 text-zinc-200 hover:border-zinc-500",
      disabled: !text.trim() || twitterRemaining < 0,
      disabledHint: "Twitter: add TWITTER_* env vars to enable",
      onPost: () => postVia("twitter", "/api/admin/tweet", { text }),
    },
    {
      key: "facebook",
      enabled: hasFacebook,
      label: statuses.facebook === "posting" ? "Posting…" : "Post to Facebook Page",
      className: "bg-[#1877F2] hover:bg-[#166fe5] text-white",
      disabled: !text.trim(),
      disabledHint: "Facebook: add FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN to enable",
      onPost: () => postVia("facebook", "/api/admin/facebook-post", { text }),
    },
    {
      key: "instagram",
      enabled: hasInstagram,
      label: statuses.instagram === "posting" ? "Posting…" : "Post to Instagram",
      className: "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white",
      disabled: !text.trim(),
      disabledHint: "Instagram: add INSTAGRAM_ACCOUNT_ID to enable (uses your Facebook Page token)",
      onPost: () => postVia("instagram", "/api/admin/instagram-post", { caption: text }),
    },
  ];

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
        placeholder="Compose post… (Instagram will use this as the caption over your EdgeBoard OG image)"
        rows={5}
        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 resize-none"
      />

      {/* Post buttons */}
      <div className="flex flex-wrap gap-2 items-center">
        {platforms.map(({ key, enabled, label, className, disabled, disabledHint, onPost }) =>
          enabled ? (
            <button
              key={key}
              type="button"
              onClick={onPost}
              disabled={disabled || statuses[key] === "posting"}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
            >
              {label}
            </button>
          ) : (
            <span key={key} className="text-xs text-zinc-600">{disabledHint}</span>
          )
        )}

        {hasTwitter && (
          <span className={`ml-auto text-xs ${twitterRemaining < 20 ? "text-red-400" : "text-zinc-600"}`}>
            {twitterRemaining} chars (Twitter limit)
          </span>
        )}
      </div>

      {/* Status messages */}
      {Object.entries(messages).map(([key, msg]) =>
        msg ? (
          <p key={key} className={`text-xs ${statuses[key] === "success" ? "text-green-400" : "text-red-400"}`}>
            {key.charAt(0).toUpperCase() + key.slice(1)}: {msg}
          </p>
        ) : null
      )}

      <p className="text-xs text-zinc-700">Reddit: use the section below — automated posting gets flagged, so the text is pre-written for you to review before submitting.</p>
    </div>
  );
}
