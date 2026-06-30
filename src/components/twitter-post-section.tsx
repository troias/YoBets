"use client";

import { useState } from "react";

const TEMPLATES = [
  `Found a live NRL arbitrage opportunity across 11 Australian bookmakers — guaranteed profit regardless of result.\n\nFree tool → yo-bets.vercel.app`,
  `NRL value bets right now — EV calculator comparing fair price vs offered price across Sportsbet, TAB, Ladbrokes + 8 more.\n\nFree → yo-bets.vercel.app`,
  `Built a free NRL odds tool:\n→ All 11 Australian bookmakers side by side\n→ Arb finder (guaranteed profit when books disagree)\n→ EV calculator with Kelly stakes\n→ Line movement + bet tracker\n\nyo-bets.vercel.app`,
];

export function TwitterPostSection({
  hasTwitter,
  hasFacebook,
  hasGroq,
}: {
  hasTwitter: boolean;
  hasFacebook: boolean;
  hasGroq: boolean;
}) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [twitterStatus, setTwitterStatus] = useState<"idle" | "posting" | "success" | "error">("idle");
  const [facebookStatus, setFacebookStatus] = useState<"idle" | "posting" | "success" | "error">("idle");
  const [twitterMsg, setTwitterMsg] = useState("");
  const [facebookMsg, setFacebookMsg] = useState("");

  const remaining = 280 - text.length;

  async function generateCaption(platform: string) {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/ai-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform }),
      });
      const data = await res.json() as { caption?: string; error?: string };
      if (data.caption) setText(data.caption);
      else alert(data.error ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function postTo(endpoint: string, payload: Record<string, string>) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { id?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed");
    return data.id;
  }

  async function postTwitter() {
    if (!text.trim() || twitterStatus === "posting") return;
    setTwitterStatus("posting"); setTwitterMsg("");
    try {
      const id = await postTo("/api/admin/tweet", { text });
      setTwitterStatus("success"); setTwitterMsg(`Posted! ID: ${id}`);
      setText("");
    } catch (e) {
      setTwitterStatus("error"); setTwitterMsg((e as Error).message);
    }
  }

  async function postFacebook() {
    if (!text.trim() || facebookStatus === "posting") return;
    setFacebookStatus("posting"); setFacebookMsg("");
    try {
      const id = await postTo("/api/admin/facebook-post", { text });
      setFacebookStatus("success"); setFacebookMsg(`Posted! ID: ${id}`);
      setText("");
    } catch (e) {
      setFacebookStatus("error"); setFacebookMsg((e as Error).message);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Twitter / X · Facebook</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Compose once, post to both. Twitter limit 280 chars.</p>
      </div>

      {/* AI generate */}
      {hasGroq && (
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (e.g. 'arb finder', 'launch announcement') — leave blank for general"
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
          <button
            type="button"
            onClick={() => generateCaption("twitter")}
            disabled={generating}
            className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 transition disabled:opacity-50"
          >
            {generating ? "Generating…" : "✦ AI Write"}
          </button>
        </div>
      )}

      {/* Templates */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((t, i) => (
          <button key={i} type="button" onClick={() => setText(t)}
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition">
            Template {i + 1}
          </button>
        ))}
      </div>

      {/* Compose */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Compose post…"
        className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 resize-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        {hasTwitter ? (
          <button type="button" onClick={postTwitter}
            disabled={!text.trim() || remaining < 0 || twitterStatus === "posting"}
            className="rounded-lg bg-zinc-900 border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-400 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {twitterStatus === "posting" ? "Posting…" : "Post to X / Twitter"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Twitter: add TWITTER_* env vars</span>
        )}

        {hasFacebook ? (
          <button type="button" onClick={postFacebook}
            disabled={!text.trim() || facebookStatus === "posting"}
            className="rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#166fe5] transition disabled:opacity-40 disabled:cursor-not-allowed">
            {facebookStatus === "posting" ? "Posting…" : "Post to Facebook"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Facebook: add FACEBOOK_PAGE_ID + TOKEN</span>
        )}

        <span className={`ml-auto text-xs ${remaining < 20 ? "text-red-400" : "text-zinc-600"}`}>
          {remaining} / 280
        </span>
      </div>

      {twitterMsg && <p className={`text-xs ${twitterStatus === "success" ? "text-green-400" : "text-red-400"}`}>Twitter: {twitterMsg}</p>}
      {facebookMsg && <p className={`text-xs ${facebookStatus === "success" ? "text-green-400" : "text-red-400"}`}>Facebook: {facebookMsg}</p>}
    </div>
  );
}
