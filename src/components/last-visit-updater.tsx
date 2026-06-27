"use client";
import { useEffect } from "react";

export function LastVisitUpdater({ now }: { now: string }) {
  useEffect(() => {
    document.cookie = `last_visit=${now}; max-age=${7 * 24 * 3600}; path=/; SameSite=Lax`;
  }, [now]);
  return null;
}
