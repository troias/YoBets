"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useRealtimeOdds(eventId: string, onUpdate: (payload: unknown) => void) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`odds:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "OddsSnapshot",
          filter: `eventId=eq.${eventId}`,
        },
        onUpdate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, onUpdate]);
}
