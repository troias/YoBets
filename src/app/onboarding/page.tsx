"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ALL_BOOKMAKERS = [
  { id: "sportsbet",  label: "Sportsbet"  },
  { id: "tab",        label: "TAB"        },
  { id: "ladbrokes",  label: "Ladbrokes"  },
  { id: "neds",       label: "Neds"       },
  { id: "pointsbet",  label: "PointsBet"  },
  { id: "unibet",     label: "Unibet"     },
  { id: "betright",   label: "BetRight"   },
  { id: "betr",       label: "Betr"       },
  { id: "betfair",    label: "Betfair"    },
  { id: "tabtouch",   label: "TABtouch"   },
  { id: "playup",     label: "PlayUp"     },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_BOOKMAKERS.map(b => b.id)));
  const [bankroll, setBankroll] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleBook(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function selectAll() { setSelected(new Set(ALL_BOOKMAKERS.map(b => b.id))); }
  function selectNone() { setSelected(new Set()); }

  function finish() {
    startTransition(async () => {
      const books = [...selected];
      // Save bankroll cookie client-side
      if (bankroll && Number(bankroll) > 0) {
        document.cookie = `bankroll=${bankroll};path=/;max-age=${365 * 86400}`;
      }
      // Mark onboarded via server action
      await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ books }) });
      // Redirect to NRL board with selected books
      const defaultBooks = ALL_BOOKMAKERS.filter(b => b.id !== "bet365").map(b => b.id);
      const isDefault = defaultBooks.every(b => books.includes(b)) && books.length === defaultBooks.length;
      router.push(isDefault ? "/nrl" : `/nrl?books=${books.join(",")}`);
    });
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">

        {/* Logo + progress */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">EdgeBoard</h1>
          <div className="flex items-center justify-center gap-2">
            <div className={`h-1.5 w-12 rounded-full transition ${step >= 1 ? "bg-amber-400" : "bg-zinc-800"}`} />
            <div className={`h-1.5 w-12 rounded-full transition ${step >= 2 ? "bg-amber-400" : "bg-zinc-800"}`} />
          </div>
          <p className="text-xs text-zinc-500">Step {step} of 2</p>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-semibold">Which bookmakers do you use?</h2>
              <p className="text-sm text-zinc-400">We&apos;ll filter the odds board to only show books you have accounts at.</p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <button onClick={selectAll} className="text-amber-500 hover:text-amber-400 transition">Select all</button>
              <span className="text-zinc-500">{selected.size} selected</span>
              <button onClick={selectNone} className="text-zinc-500 hover:text-zinc-300 transition">Clear</button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_BOOKMAKERS.map(bm => {
                const active = selected.has(bm.id);
                return (
                  <button key={bm.id} onClick={() => toggleBook(bm.id)}
                    className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                      active
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                        : "border-zinc-800 bg-zinc-950/90 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    }`}>
                    {bm.label}
                  </button>
                );
              })}
            </div>

            <button onClick={() => setStep(2)}
              disabled={selected.size === 0}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40">
              Next →
            </button>
            <button onClick={finish} disabled={isPending}
              className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition">
              Skip setup
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-semibold">What&apos;s your bankroll?</h2>
              <p className="text-sm text-zinc-400">
                Optional — used to show recommended stake sizes on the EV finder using Quarter Kelly.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 1000"
                  value={bankroll}
                  onChange={e => setBankroll(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 pl-7 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-amber-500/50"
                />
              </div>
              <p className="text-xs text-zinc-600">
                Quarter Kelly will never recommend more than ~5% of your bankroll on a single bet.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-zinc-800 py-3 text-sm text-zinc-400 transition hover:bg-zinc-900">
                ← Back
              </button>
              <button onClick={finish} disabled={isPending}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40">
                {isPending ? "Setting up…" : "Go to EdgeBoard →"}
              </button>
            </div>
            <button onClick={finish} disabled={isPending}
              className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition">
              Skip
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
