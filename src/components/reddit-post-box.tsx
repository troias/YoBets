"use client";

import { useState } from "react";

type Sub = { name: string; flair?: string };

const SUBREDDITS: Sub[] = [
  { name: "sportsbetting" },
  { name: "NRL" },
  { name: "ausfinance" },
  { name: "betoota" },
];

const TEMPLATES: Record<string, { title: string; text: string }> = {
  sportsbetting: {
    title: "Built a free NRL odds comparison tool — arb finder, EV calculator, line movement across 11 bookmakers",
    text: `Hey r/sportsbetting,

Been building an NRL betting analytics tool and wanted to share it here since this community appreciates what it does.

**What it shows you (all free):**

**Odds Board** — every Australian bookmaker side by side (Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch, PlayUp). Best available price highlighted. Cells flash when odds move.

**Arb Finder** — scans all 11 books and flags when combined implied probability drops below 100%. Shows which books to use, exact stake split, guaranteed return. Enter your bookmaker balances and it scales stakes to what you actually have.

**EV Finder** — no-vig consensus model to calculate fair odds. EV% per bet, fair price vs offered price, ¼ Kelly stake recommendation.

**Line Movement** — price history across 1h to 48h windows. Steam move flags.

**Bet Tracker** — log bets, see P&L, ROI, win rate, per-bookmaker breakdown.

**What's free vs paid:**

Everything above is free. Pro ($19 AUD/month) adds push/email/SMS notifications for arbs, EV bets, and price alerts.

**Caveats:**
- Odds poll every 2 min within 3h of kickoff, 5 min within 24h
- NRL only right now
- One-person build

Link: **https://yo-bets.vercel.app**

Happy to answer questions about how the calculations work.`,
  },
  NRL: {
    title: "Made a free tool that compares NRL odds across every Australian bookie — thought this community might find it useful",
    text: `Hey everyone,

Built something I've been wanting for a while — a site that pulls NRL odds from all the major Australian bookmakers and puts them side by side.

**What it does:**
- Compares Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch and PlayUp in one place
- Highlights the best available price for each outcome
- Finds arbitrage opportunities — when books disagree enough that you can cover both sides and guarantee a profit
- Shows expected value bets with fair price comparison
- Tracks your bookmaker balances so the arb finder shows exact stakes
- Star your team to always see their games at the top
- Bet tracker with P&L, ROI, and per-bookmaker stats

**Completely free** — just sign up with an email. Paid version ($19/month) for people who want push alerts when an arb pops up.

Link: **https://yo-bets.vercel.app**

Not a tipster, not affiliated with any bookmaker. Just a tool.`,
  },
  ausfinance: {
    title: "Built a tool to find NRL arbitrage opportunities across 11 Australian bookmakers (free)",
    text: `For those who do matched betting or are interested in risk-free returns from bookmaker disagreements:

Built an NRL arbitrage finder that scans 11 Australian bookmakers simultaneously and flags when the combined implied probability drops below 100% — meaning you can cover both outcomes and lock in a profit regardless of the result.

If you enter your bookmaker balances, it automatically scales the stake suggestions to what you actually have at each book.

Also has:
- EV calculator with no-vig consensus model and quarter Kelly recommendations
- Line movement tracking
- Bet tracker with P&L, ROI, win rate, per-bookmaker breakdown

Everything is free. No credit card required.

**https://yo-bets.vercel.app**

Note: arb windows typically close within minutes as books adjust. The site polls every 2 minutes within 3 hours of kickoff. Pro subscribers get push notifications instantly.`,
  },
  betoota: {
    title: "Free NRL odds comparison tool — all 11 bookmakers side by side",
    text: `Tired of checking five bookie apps before every NRL bet?

Built a site that compares Sportsbet, TAB, Ladbrokes, Neds, PointsBet, Unibet, BetRight, Betr, Betfair, TABtouch and PlayUp in one place.

Shows arbs, EV bets, line movement and tracks your P&L. Free to use.

https://yo-bets.vercel.app`,
  },
};

export function RedditPostBox({ hasReddit }: { hasReddit: boolean }) {
  const [subs, setSubs] = useState<Sub[]>(SUBREDDITS);
  const [newSub, setNewSub] = useState("");
  const [selected, setSelected] = useState<Sub>(SUBREDDITS[0]);
  const [title, setTitle] = useState(TEMPLATES[SUBREDDITS[0].name]?.title ?? "");
  const [text, setText] = useState(TEMPLATES[SUBREDDITS[0].name]?.text ?? "");
  const [status, setStatus] = useState<"idle" | "posting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function selectSub(sub: Sub) {
    setSelected(sub);
    const tpl = TEMPLATES[sub.name];
    if (tpl) { setTitle(tpl.title); setText(tpl.text); }
  }

  function addSub() {
    const name = newSub.trim().replace(/^r\//, "");
    if (!name || subs.find((s) => s.name === name)) return;
    const next = [...subs, { name }];
    setSubs(next);
    setNewSub("");
  }

  function removeSub(name: string) {
    setSubs((prev) => prev.filter((s) => s.name !== name));
    if (selected.name === name) selectSub(subs[0]);
  }

  async function post() {
    if (!title.trim() || !text.trim() || status === "posting") return;
    setStatus("posting");
    setMessage("");
    try {
      const res = await fetch("/api/admin/reddit-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subreddit: selected.name, title, text }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || data.error) {
        setStatus("error");
        setMessage(data.error ?? "Failed to post");
      } else {
        setStatus("success");
        setMessage(`Posted to r/${selected.name}!`);
      }
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  }

  if (!hasReddit) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
          <p className="font-medium mb-1">Reddit credentials not configured</p>
          <p className="text-xs text-amber-400/70 mb-3">Add these 4 env vars to Vercel, then redeploy:</p>
          <div className="space-y-1 font-mono text-xs text-amber-300/80">
            <p>REDDIT_CLIENT_ID</p>
            <p>REDDIT_CLIENT_SECRET</p>
            <p>REDDIT_USERNAME</p>
            <p>REDDIT_PASSWORD</p>
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-xs text-zinc-400 space-y-2">
          <p className="font-medium text-zinc-300">How to get Reddit credentials (5 min):</p>
          <ol className="ml-3 list-decimal space-y-1">
            <li>Go to <span className="text-amber-400">reddit.com/prefs/apps</span></li>
            <li>Click <strong className="text-zinc-200">Create another app…</strong></li>
            <li>Name: EdgeBoard · Type: <strong className="text-zinc-200">script</strong> · Redirect URI: http://localhost</li>
            <li>Click Create — copy the <strong className="text-zinc-200">client ID</strong> (under app name) and <strong className="text-zinc-200">secret</strong></li>
            <li>Use your Reddit username + password as the remaining 2 vars</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subreddit selector */}
      <div>
        <p className="mb-2 text-xs text-zinc-500">Target subreddits</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {subs.map((sub) => (
            <div key={sub.name} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => selectSub(sub)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  selected.name === sub.name
                    ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                r/{sub.name}
              </button>
              <button
                type="button"
                onClick={() => removeSub(sub.name)}
                className="text-zinc-700 hover:text-red-400 transition text-xs leading-none"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSub()}
            placeholder="Add subreddit (e.g. ausfinance)"
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
          <button
            type="button"
            onClick={addSub}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <p className="mb-1.5 text-xs text-zinc-500">Post title</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        />
        <p className="mt-1 text-xs text-zinc-700">{title.length}/300 chars</p>
      </div>

      {/* Body */}
      <div>
        <p className="mb-1.5 text-xs text-zinc-500">Post body (supports markdown)</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 resize-none font-mono"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-600 space-y-0.5">
          <p>Posting to: <span className="text-orange-400 font-medium">r/{selected.name}</span></p>
          <p>Best time: Thursday evening or Sunday afternoon before games</p>
        </div>
        <button
          type="button"
          onClick={post}
          disabled={!title.trim() || !text.trim() || status === "posting"}
          className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "posting" ? "Posting…" : `Post to r/${selected.name}`}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${status === "success" ? "text-green-400" : "text-red-400"}`}>
          {message}
        </p>
      )}

      <p className="text-xs text-zinc-700 border-t border-zinc-800 pt-3">
        Tip: wait 48h between posts to different subreddits. Don&apos;t post the same text twice. Reply to comments quickly — early engagement bumps Reddit ranking.
      </p>
    </div>
  );
}
