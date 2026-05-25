"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OddsPoint } from "@/lib/types";

export function MarketChart({ data }: { data: OddsPoint[] }) {
  return (
    <div className="h-64 min-h-64 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 text-sm font-semibold">Line Movement</div>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data}>
          <XAxis dataKey="timestamp" hide />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="odds" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineHistoryChart({ data }: { data: OddsPoint[] }) {
  return (
    <div className="h-64 min-h-64 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 text-sm font-semibold">Implied Probability History</div>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data.map((d) => ({ ...d, implied: (1 / d.odds) * 100 }))}>
          <XAxis dataKey="timestamp" hide />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="implied" stroke="#34d399" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
