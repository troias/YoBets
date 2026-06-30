"use client";

import { useState } from "react";

const IMAGE_STYLES = [
  { label: "Dark dashboard", prompt: "professional dark sports betting analytics dashboard NRL Australian football data charts amber accents minimal UI dark background" },
  { label: "Win celebration", prompt: "Australian sports fan celebrating winning bet NRL football stadium crowd excitement professional photography cinematic" },
  { label: "Data visualization", prompt: "dark professional financial data visualization sports odds comparison charts Australian betting market amber gold accents" },
  { label: "Sharp bettor", prompt: "sharp professional Australian sports bettor checking odds on phone multiple bookmakers NRL game dark moody cinematic" },
];

function pollinationsUrl(prompt: string, seed = 42) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&seed=${seed}&model=flux`;
}

export function InstagramPostSection({
  hasInstagram,
  hasGroq,
}: {
  hasInstagram: boolean;
  hasGroq: boolean;
}) {
  const [topic, setTopic] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [seed, setSeed] = useState(42);
  const [postStatus, setPostStatus] = useState<"idle" | "posting" | "success" | "error">("idle");
  const [postMsg, setPostMsg] = useState("");

  function generateImage(prompt: string) {
    setImageLoading(true);
    const newSeed = Math.floor(Math.random() * 9999);
    setSeed(newSeed);
    const url = pollinationsUrl(prompt, newSeed);
    setImageUrl(url);
  }

  async function generateCaption() {
    if (!hasGroq) return;
    setCaptionLoading(true);
    try {
      const res = await fetch("/api/admin/ai-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || "EdgeBoard NRL odds comparison app", platform: "instagram" }),
      });
      const data = await res.json() as { caption?: string; error?: string };
      if (data.caption) setCaption(data.caption);
      else alert(data.error ?? "Generation failed");
    } finally {
      setCaptionLoading(false);
    }
  }

  async function postToInstagram() {
    if (!caption.trim() || !imageUrl || postStatus === "posting") return;
    setPostStatus("posting"); setPostMsg("");
    try {
      const res = await fetch("/api/admin/instagram-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setPostStatus("error"); setPostMsg(data.error ?? "Failed"); }
      else { setPostStatus("success"); setPostMsg(`Posted! ID: ${data.id}`); setCaption(""); setImageUrl(""); }
    } catch {
      setPostStatus("error"); setPostMsg("Network error");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Instagram</h2>
        <p className="mt-0.5 text-xs text-zinc-500">AI generates the image + caption. Review before posting.</p>
      </div>

      {/* Step 1: Image */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-zinc-400">1 — Generate image</p>
        <div className="flex flex-wrap gap-2">
          {IMAGE_STYLES.map((s) => (
            <button key={s.label} type="button"
              onClick={() => { setCustomPrompt(s.prompt); generateImage(s.prompt); }}
              className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition">
              {s.label}
            </button>
          ))}
        </div>

        {/* Custom prompt */}
        <div className="flex gap-2">
          <input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Or describe your own image…"
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
          <button type="button"
            onClick={() => customPrompt.trim() && generateImage(customPrompt)}
            disabled={!customPrompt.trim()}
            className="shrink-0 rounded-lg bg-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-600 transition disabled:opacity-40">
            Generate
          </button>
          {imageUrl && (
            <button type="button"
              onClick={() => generateImage(customPrompt || IMAGE_STYLES[0].prompt)}
              className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-700 transition">
              Regenerate
            </button>
          )}
        </div>

        {/* Image preview */}
        {imageUrl && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Generated Instagram image"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
              className={`w-full max-w-xs rounded-xl border border-zinc-800 transition-opacity ${imageLoading ? "opacity-30" : "opacity-100"}`}
            />
            {imageLoading && (
              <div className="absolute inset-0 flex max-w-xs items-center justify-center">
                <p className="text-xs text-zinc-500 animate-pulse">Generating…</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Caption */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-zinc-400">2 — Write caption</p>
        {hasGroq ? (
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic (e.g. 'arb finder', 'launch', 'EV bets') — or leave blank"
              className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
            />
            <button type="button" onClick={generateCaption} disabled={captionLoading}
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 transition disabled:opacity-50">
              {captionLoading ? "Writing…" : "✦ AI Write"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-amber-500/80">Add GROQ_API_KEY in App Config to enable AI caption writing (free at console.groq.com)</p>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={7}
          placeholder="Caption will appear here — or write your own…"
          className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 resize-none"
        />
      </div>

      {/* Step 3: Post */}
      <div className="flex items-center gap-3">
        {hasInstagram ? (
          <button type="button" onClick={postToInstagram}
            disabled={!caption.trim() || !imageUrl || postStatus === "posting"}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-medium text-white hover:from-purple-500 hover:to-pink-400 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {postStatus === "posting" ? "Posting…" : "Post to Instagram"}
          </button>
        ) : (
          <p className="text-xs text-zinc-600">Instagram: add INSTAGRAM_ACCOUNT_ID + FACEBOOK_PAGE_ACCESS_TOKEN in Vercel env vars</p>
        )}
        {!imageUrl && hasInstagram && (
          <p className="text-xs text-zinc-600">← Generate an image first</p>
        )}
      </div>

      {postMsg && (
        <p className={`text-xs ${postStatus === "success" ? "text-green-400" : "text-red-400"}`}>{postMsg}</p>
      )}

      <p className="text-xs text-zinc-700 border-t border-zinc-800 pt-3">
        Images generated free via Pollinations AI (no API key needed). Groq generates captions with hashtags optimised for NRL betting audience.
      </p>
    </div>
  );
}
