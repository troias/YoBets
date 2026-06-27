"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BankrollInput({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue > 0 ? String(initialValue) : "");
  const router = useRouter();

  function apply(raw: string) {
    const n = Math.max(0, Number(raw) || 0);
    const maxAge = 365 * 24 * 3600;
    if (n > 0) {
      document.cookie = `bankroll=${n}; max-age=${maxAge}; path=/; SameSite=Lax`;
    } else {
      document.cookie = `bankroll=; max-age=0; path=/; SameSite=Lax`;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-xs text-zinc-500">Bankroll</span>
      <span className="text-xs text-zinc-600">$</span>
      <input
        type="number"
        min="0"
        step="100"
        value={value}
        placeholder="e.g. 1000"
        onChange={e => setValue(e.target.value)}
        onBlur={e => apply(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") apply((e.target as HTMLInputElement).value); }}
        className="w-24 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}
