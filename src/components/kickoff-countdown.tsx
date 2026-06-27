"use client";

import { useState, useEffect } from "react";

export function KickoffCountdown({ kickoffAt }: { kickoffAt: string }) {
  const getMs = () => new Date(kickoffAt).getTime() - Date.now();

  const [ms, setMs] = useState(getMs);

  useEffect(() => {
    setMs(getMs());
    const id = setInterval(() => setMs(getMs()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickoffAt]);

  if (ms <= 0) {
    return <span className="text-[10px] font-semibold text-green-400 animate-pulse">LIVE</span>;
  }

  const totalSecs = Math.floor(ms / 1000);
  const days  = Math.floor(totalSecs / 86_400);
  const hours = Math.floor((totalSecs % 86_400) / 3_600);
  const mins  = Math.floor((totalSecs % 3_600) / 60);
  const secs  = totalSecs % 60;

  const urgency = totalSecs < 3_600
    ? "text-amber-400 font-semibold"
    : totalSecs < 10_800
    ? "text-zinc-300"
    : "text-zinc-500";

  const label = days > 0
    ? `${days}d ${hours}h`
    : hours > 0
    ? `${hours}h ${String(mins).padStart(2, "0")}m`
    : `${mins}m ${String(secs).padStart(2, "0")}s`;

  return (
    <span className={`text-[10px] tabular-nums ${urgency}`}>{label} to kick</span>
  );
}
