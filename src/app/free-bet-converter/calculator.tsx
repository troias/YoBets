"use client";

import { useState } from "react";

type Mode = "snr" | "sr";

function calc(mode: Mode, freeBet: number, backOdds: number, otherOdds: number) {
  if (!freeBet || !backOdds || !otherOdds || backOdds < 1.01 || otherOdds < 1.01) return null;

  if (mode === "snr") {
    // Stake Not Returned — standard AU free bet
    // Back free bet F at odds bA, back other side L at odds bB
    // Win if A: (bA-1)*F - L
    // Win if B: (bB-1)*L
    // Equal profit: L = (bA-1)*F / bB
    const otherStake = ((backOdds - 1) * freeBet) / otherOdds;
    const profit = (otherOdds - 1) * otherStake;
    const conversionRate = profit / freeBet;
    return { otherStake, profit, conversionRate };
  } else {
    // Stake Returned — less common (e.g. bonus cash bets)
    // Back free bet F at odds bA, back other side L at odds bB
    // Win if A: (bA-1)*F - L
    // Win if B: (bB-1)*L - F
    // Equal profit: L = (bA-1)*F / (bB-1) ... wait this is a standard arb
    // Actually for SR free bet it behaves like cash:
    // Back F at bA — win: (bA-1)*F, lose: -F
    // Back L at bB — win: (bB-1)*L, lose: -L
    // Equal profit (accounting for F being returned if win):
    // (bA-1)*F - L = (bB-1)*L - F
    // bA*F - F - L = bB*L - L - F
    // bA*F = bB*L
    // L = bA*F / bB
    const otherStake = (backOdds * freeBet) / otherOdds;
    const profit = (otherOdds - 1) * otherStake - freeBet;
    const conversionRate = profit / freeBet;
    return { otherStake, profit, conversionRate };
  }
}

export function FreeBetCalculator() {
  const [mode, setMode] = useState<Mode>("snr");
  const [freeBet, setFreeBet] = useState("");
  const [backOdds, setBackOdds] = useState("");
  const [otherOdds, setOtherOdds] = useState("");

  const result = calc(
    mode,
    parseFloat(freeBet),
    parseFloat(backOdds),
    parseFloat(otherOdds),
  );

  const inputClass =
    "w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 placeholder-zinc-600";

  return (
    <div className="max-w-md space-y-5">

      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1">
        {(["snr", "sr"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "snr" ? "Stake Not Returned (SNR)" : "Stake Returned (SR)"}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        {mode === "snr"
          ? "Standard AU free bet — your free bet stake is not returned if you win. Back both sides of a H2H market to lock in guaranteed cash."
          : "Bonus cash bet — the stake is returned if you win, same as real money. Useful for deposit bonuses."}
      </p>

      {/* Inputs */}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Free bet amount ($)</label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 50"
            value={freeBet}
            onChange={(e) => setFreeBet(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Back odds — bookmaker where free bet is placed
          </label>
          <input
            type="number"
            min="1.01"
            step="0.01"
            placeholder="e.g. 2.20"
            value={backOdds}
            onChange={(e) => setBackOdds(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Other side odds — second bookmaker (real money bet)
          </label>
          <input
            type="number"
            min="1.01"
            step="0.01"
            placeholder="e.g. 1.85"
            value={otherOdds}
            onChange={(e) => setOtherOdds(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Result */}
      {result ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold text-zinc-100">
                ${result.otherStake.toFixed(2)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">Stake other side</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-400">
                ${result.profit.toFixed(2)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">Guaranteed profit</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${result.conversionRate >= 0.7 ? "text-green-400" : result.conversionRate >= 0.5 ? "text-amber-400" : "text-red-400"}`}>
                {(result.conversionRate * 100).toFixed(1)}%
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">Conversion rate</div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3 space-y-1.5 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Place free bet of <span className="text-zinc-200">${parseFloat(freeBet || "0").toFixed(2)}</span> at <span className="text-zinc-200">{parseFloat(backOdds || "0").toFixed(2)}</span></span>
              <span className="text-zinc-500">free bet</span>
            </div>
            <div className="flex justify-between">
              <span>Place <span className="text-zinc-200">${result.otherStake.toFixed(2)}</span> at <span className="text-zinc-200">{parseFloat(otherOdds || "0").toFixed(2)}</span> (other side)</span>
              <span className="text-zinc-500">real money</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t border-zinc-800 text-green-400">
              <span>Guaranteed profit regardless of result</span>
              <span>+${result.profit.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-600">
          Enter free bet amount and both sides' odds to see the result
        </div>
      )}

      {/* Tips */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 space-y-2">
        <p className="text-xs font-medium text-zinc-400">Tips for best conversion</p>
        <ul className="space-y-1 text-xs text-zinc-600">
          <li>• Target 70–80%+ conversion rate — anything below 60% is a poor use of a free bet</li>
          <li>• Use markets close to 50/50 (both sides ~2.00) for highest conversion</li>
          <li>• Check the Odds Board for the best prices across 12 bookmakers</li>
          <li>• Betfair Exchange gives the best lay prices if you have an account</li>
        </ul>
      </div>
    </div>
  );
}
