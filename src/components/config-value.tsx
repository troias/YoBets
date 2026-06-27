"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

export function ConfigValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const masked = value.length > 8
    ? value.slice(0, 4) + "••••••••••••" + value.slice(-4)
    : "••••••••";

  return (
    <div className="flex flex-1 items-center gap-1.5">
      <span className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-300 ring-1 ring-zinc-800 overflow-hidden break-all">
        {revealed ? value : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        title={revealed ? "Hide" : "Reveal"}
        className="shrink-0 rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className="shrink-0 rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
