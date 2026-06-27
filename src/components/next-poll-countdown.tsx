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
    return <span className="text-xs text-zinc-500 animate-pulse">updating…</span>;
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <span className="text-xs text-zinc-500">
      next update {mins > 0 ? `${mins}m ` : ""}{secs}s
    </span>
  );
}
