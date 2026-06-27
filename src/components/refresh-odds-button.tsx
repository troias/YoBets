"use client";

import { useState } from "react";

type Result = { oddsCount: number; matchCount: number; durationMs: number };

export function RefreshOddsButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setState("loading");
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/cron", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: Result = await res.json();
      setResult(data);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={state === "loading"}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === "loading" ? "Fetching…" : "Refresh Odds Now"}
      </button>
      {state === "done" && result && (
        <span className="text-xs text-green-400">
          ✓ {result.oddsCount} odds · {result.matchCount} matches · {(result.durationMs / 1000).toFixed(1)}s
        </span>
      )}
      {state === "error" && (
        <span className="text-xs text-red-400">✗ {error}</span>
      )}
    </div>
  );
}
