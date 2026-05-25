"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export function BetCalculator() {
  const [stake, setStake] = useState(50);
  const [odds, setOdds] = useState(2.1);
  const payout = useMemo(() => stake * odds, [stake, odds]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold">Bet Calculator</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
        <Input type="number" step="0.01" value={odds} onChange={(e) => setOdds(Number(e.target.value))} />
      </div>
      <div className="mt-3 text-sm text-zinc-300">Potential return: {payout.toFixed(2)}</div>
    </div>
  );
}
