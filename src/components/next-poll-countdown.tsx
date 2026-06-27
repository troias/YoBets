"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function NextPollCountdown({ nextPollAt }: { nextPollAt: string }) {
  const router = useRouter();
  const refreshedRef = useRef(false);

  const getSecondsLeft = () =>
    Math.max(0, Math.round((new Date(nextPollAt).getTime() - Date.now()) / 1000));

  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    refreshedRef.current = false;
    setSecondsLeft(getSecondsLeft());

    const interval = setInterval(() => {
      const s = getSecondsLeft();
      setSecondsLeft(s);
      if (s === 0 && !refreshedRef.current) {
        refreshedRef.current = true;
        // Give the worker ~10s to finish writing before refreshing page data
        setTimeout(() => router.refresh(), 10_000);
      }
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPollAt]);

  if (secondsLeft === 0) {
    return <span className="text-xs text-green-400 animate-pulse font-medium">refreshing…</span>;
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");

  const urgencyClass =
    secondsLeft < 60  ? "text-red-400 animate-pulse font-medium" :
    secondsLeft < 180 ? "text-amber-400" :
    "text-zinc-500";

  return (
    <span className={`text-xs ${urgencyClass}`}>
      next update {mins > 0 ? `${mins}m ` : ""}{secs}s
    </span>
  );
}
