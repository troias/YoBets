"use client";

import { useQuery } from "@tanstack/react-query";
import type { OddsRow } from "@/lib/types";

async function fetchLiveOdds(): Promise<OddsRow[]> {
  const response = await fetch("/api/odds?page=1&pageSize=20&sortBy=evPercent&order=desc", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch odds");
  }

  const payload = await response.json();
  return payload.data;
}

export function useLiveOdds() {
  return useQuery({
    queryKey: ["live-odds"],
    queryFn: fetchLiveOdds,
    refetchInterval: 15_000,
  });
}
