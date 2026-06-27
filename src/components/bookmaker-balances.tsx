"use client";

import { useState, useEffect } from "react";

const BOOKMAKERS = [
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

function readBalances(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const raw = document.cookie.split(";").find(c => c.trim().startsWith("bm_balances="));
  if (!raw) return {};
  try { return JSON.parse(decodeURIComponent(raw.split("=").slice(1).join("="))); }
  catch { return {}; }
}

function saveBalances(balances: Record<string, string>) {
  const json = encodeURIComponent(JSON.stringify(balances));
  document.cookie = `bm_balances=${json};path=/;max-age=${365 * 86400};samesite=lax`;
}

export function BookmakerBalances() {
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { setBalances(readBalances()); }, []);

  function handleChange(id: string, value: string) {
    setBalances(prev => ({ ...prev, [id]: value }));
    setSaved(false);
  }

  function handleSave() {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(balances)) {
      if (v && Number(v) > 0) clean[k] = v;
    }
    saveBalances(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const total = Object.values(balances).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-300">Bookmaker Balances</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Enter your current balance at each book. The arb finder will scale stake suggestions to fit your available funds.
        </p>
      </div>

      <div className="space-y-2">
        {BOOKMAKERS.map(bm => (
          <div key={bm.id} className="flex items-center justify-between gap-3">
            <span className="w-24 shrink-0 text-xs text-zinc-400">{bm.label}</span>
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">$</span>
              <input
                type="number"
                min="0"
                step="10"
                placeholder="—"
                value={balances[bm.id] ?? ""}
                onChange={e => handleChange(bm.id, e.target.value)}
                className="w-full rounded-lg bg-zinc-900 pl-6 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
              />
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <p className="text-xs text-zinc-600">Total tracked: <span className="text-zinc-400">${total.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></p>
      )}

      <button
        onClick={handleSave}
        className={`w-full rounded-lg py-2 text-xs font-medium transition ${saved ? "bg-green-700 text-green-100" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
      >
        {saved ? "Saved ✓" : "Save balances"}
      </button>
    </div>
  );
}
