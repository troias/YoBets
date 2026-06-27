"use client";

import { useState } from "react";

export function ReferralSection({
  refCode,
  refCount,
  siteUrl,
}: {
  refCode: string;
  refCount: number;
  siteUrl: string;
}) {
  const link = `${siteUrl}/register?ref=${refCode}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Refer a friend — get 2 weeks free</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Share your link. When a friend signs up and starts a Pro trial, you both get 2 extra weeks free.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-300 truncate ring-1 ring-zinc-800">
          {link}
        </div>
        <button
          onClick={copy}
          className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${copied ? "bg-green-700 text-green-100" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-600">
        <span className="rounded-full border border-zinc-800 px-2.5 py-0.5 text-zinc-500">
          Your code: <span className="font-mono font-medium text-zinc-300">{refCode}</span>
        </span>
        {refCount > 0 && (
          <span className="text-zinc-500">{refCount} referral{refCount !== 1 ? "s" : ""} so far</span>
        )}
      </div>
    </div>
  );
}
