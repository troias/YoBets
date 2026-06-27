import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { logBet, settleBet, deleteBet } from "@/app/actions/bets";

type BetRow = {
  id: string; userId: string; matchName: string; bookmaker: string; outcome: string;
  odds: number | string; stake: number | string; profit: number | string | null;
  closingOdds: number | string | null; result: string; betType: string;
  notes: string | null; placedAt: Date;
};

const BET_TYPE_LABEL: Record<string, string> = {
  manual: "Manual", arb: "Arb", ev: "EV", free_bet: "Free Bet",
};

const RESULT_STYLE: Record<string, string> = {
  win: "text-green-400", lose: "text-red-400", pending: "text-zinc-500", void: "text-zinc-600",
};

function clvPercent(placedOdds: number, closingOdds: number): number {
  return ((placedOdds / closingOdds) - 1) * 100;
}

export default async function BetsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bets = (await prisma.betLog.findMany({
    where: { userId: user.id },
    orderBy: { placedAt: "desc" },
  })) as unknown as BetRow[];

  const settled  = bets.filter(b => b.result !== "pending" && b.result !== "void");
  const pending  = bets.filter(b => b.result === "pending");
  const withClv  = settled.filter(b => b.closingOdds !== null && Number(b.closingOdds) > 1);

  const totalStaked = settled.reduce((s, b) => s + Number(b.stake), 0);
  const totalProfit = settled.reduce((s, b) => s + Number(b.profit ?? 0), 0);
  const roi         = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const wins        = settled.filter(b => b.result === "win").length;
  const winRate     = settled.length > 0 ? (wins / settled.length) * 100 : 0;
  const avgStake    = settled.length > 0 ? totalStaked / settled.length : 0;
  const units       = avgStake > 0 ? totalProfit / avgStake : 0;
  const avgClv      = withClv.length > 0
    ? withClv.reduce((s, b) => s + clvPercent(Number(b.odds), Number(b.closingOdds)), 0) / withClv.length
    : null;

  const hasClv = withClv.length > 0;

  return (
    <AppShell activePath="/bets" userEmail={user.email}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Bet Tracker</h1>
          <p className="text-sm text-zinc-400">Log bets, track P&amp;L, and measure your edge with Closing Line Value</p>
        </div>

        {/* Stats */}
        {settled.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Total P&L", value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`, accent: totalProfit >= 0 ? "text-green-400" : "text-red-400" },
              { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, accent: roi >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Units", value: `${units >= 0 ? "+" : ""}${units.toFixed(2)}u`, accent: units >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Win rate", value: `${winRate.toFixed(0)}%`, accent: "text-zinc-100" },
              { label: "Settled bets", value: settled.length.toString(), accent: "text-zinc-100" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
                <div className={`text-2xl font-bold ${accent}`}>{value}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* CLV summary */}
        {hasClv && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-300">
                  Avg Closing Line Value: {avgClv! >= 0 ? "+" : ""}{avgClv!.toFixed(2)}%
                  <span className="ml-2 text-xs font-normal text-zinc-500">across {withClv.length} settled bet{withClv.length !== 1 ? "s" : ""}</span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {avgClv! > 0
                    ? "Positive CLV means you're consistently getting better prices than where the market settles — a sign of real edge."
                    : "CLV below zero means you're typically getting worse than closing price. Try targeting earlier markets."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Log a bet */}
        <form action={logBet}>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Log a bet</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Match</label>
                <input name="matchName" required placeholder="e.g. Broncos vs Storm"
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Bookmaker</label>
                <input name="bookmaker" required placeholder="e.g. Sportsbet"
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Outcome / Selection</label>
                <input name="outcome" required placeholder="e.g. Broncos ML"
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Odds</label>
                  <input name="odds" type="number" step="0.01" min="1.01" required placeholder="2.10"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Stake ($)</label>
                  <input name="stake" type="number" step="0.01" min="0.01" required placeholder="50.00"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Type</label>
                <select name="betType"
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600">
                  <option value="manual">Manual</option>
                  <option value="ev">EV Bet</option>
                  <option value="arb">Arb</option>
                  <option value="free_bet">Free Bet</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Notes (optional)</label>
                <input name="notes" placeholder="e.g. +3.2% EV, Sportsbet"
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600" />
              </div>
            </div>
            <button type="submit"
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-600">
              Log bet
            </button>
          </div>
        </form>

        {/* Pending bets */}
        {pending.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-300">Pending ({pending.length})</h2>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {pending.map(bet => (
                <div key={bet.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-200">{bet.matchName}</div>
                      <div className="text-xs text-zinc-500">
                        {bet.bookmaker} · {bet.outcome} · @ {Number(bet.odds).toFixed(2)} · ${Number(bet.stake).toFixed(2)}
                        {bet.betType !== "manual" && <span className="ml-1.5 rounded bg-zinc-800 px-1.5 py-0.5">{BET_TYPE_LABEL[bet.betType]}</span>}
                      </div>
                    </div>
                    <form action={deleteBet}>
                      <input type="hidden" name="id" value={bet.id} />
                      <button type="submit" className="text-xs text-zinc-700 hover:text-red-400 transition">✕</button>
                    </form>
                  </div>
                  <form action={settleBet} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={bet.id} />
                    <input
                      name="closingOdds"
                      type="number"
                      step="0.01"
                      min="1.01"
                      placeholder="Closing odds (optional)"
                      className="w-44 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
                    />
                    <button type="submit" name="result" value="win"
                      className="rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs font-medium text-green-400 transition hover:bg-green-500/20">
                      Won
                    </button>
                    <button type="submit" name="result" value="lose"
                      className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20">
                      Lost
                    </button>
                    <button type="submit" name="result" value="void"
                      className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-700">
                      Void
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settled bets */}
        {settled.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-300">History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Match</th>
                    <th className="px-4 py-2.5 text-left text-xs font-normal text-zinc-500">Selection</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Odds</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Stake</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">Result</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">P&amp;L</th>
                    <th className="px-4 py-2.5 text-center text-xs font-normal text-zinc-500">CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {settled.map((bet, i) => {
                    const clv = bet.closingOdds !== null && Number(bet.closingOdds) > 1
                      ? clvPercent(Number(bet.odds), Number(bet.closingOdds))
                      : null;
                    return (
                      <tr key={bet.id} className={i % 2 === 0 ? "bg-transparent" : "bg-zinc-950/40"}>
                        <td className="px-4 py-3">
                          <div className="text-zinc-200">{bet.matchName}</div>
                          <div className="text-xs text-zinc-600">
                            {bet.placedAt.toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short" })}
                            {bet.betType !== "manual" && <span className="ml-1.5">{BET_TYPE_LABEL[bet.betType]}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{bet.bookmaker} · {bet.outcome}</td>
                        <td className="px-4 py-3 text-center text-zinc-300">{Number(bet.odds).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center text-zinc-300">${Number(bet.stake).toFixed(2)}</td>
                        <td className={`px-4 py-3 text-center font-medium capitalize ${RESULT_STYLE[bet.result] ?? "text-zinc-400"}`}>
                          {bet.result}
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold ${Number(bet.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {bet.profit !== null ? `${Number(bet.profit) >= 0 ? "+" : ""}$${Number(bet.profit).toFixed(2)}` : "—"}
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-medium ${clv === null ? "text-zinc-700" : clv >= 0 ? "text-amber-400" : "text-zinc-500"}`}>
                          {clv === null ? "—" : `${clv >= 0 ? "+" : ""}${clv.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!hasClv && (
              <div className="border-t border-zinc-800/50 px-4 py-3">
                <p className="text-xs text-zinc-600">
                  Add closing odds when you settle a bet to track your Closing Line Value — the professional measure of betting edge.
                </p>
              </div>
            )}
          </div>
        )}

        {bets.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
            <p className="text-sm text-zinc-500">No bets logged yet. Use the form above to track your first bet.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
