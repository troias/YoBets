"use client";

import { useState, useTransition } from "react";
import { createPriceAlert, deletePriceAlert } from "@/app/actions/price-alerts";

export function PriceAlertButton({
  matchId,
  matchName,
  outcome,
  teamName,
  currentBestPrice,
  existingAlertId,
  existingTargetPrice,
}: {
  matchId: string;
  matchName: string;
  outcome: string;
  teamName: string;
  currentBestPrice: number;
  existingAlertId?: string;
  existingTargetPrice?: number;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(
    existingTargetPrice?.toFixed(2) ?? currentBestPrice.toFixed(2),
  );
  const [saved, setSaved] = useState(!!existingAlertId);
  const [activeId, setActiveId] = useState(existingAlertId);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const val = parseFloat(price);
    if (!val || val <= 1) return;
    startTransition(async () => {
      const res = await createPriceAlert(matchId, matchName, outcome, val);
      if (!res.error) {
        setSaved(true);
        setOpen(false);
      }
    });
  }

  function handleDelete() {
    if (!activeId) { setSaved(false); setOpen(false); return; }
    startTransition(async () => {
      await deletePriceAlert(activeId);
      setSaved(false);
      setActiveId(undefined);
      setOpen(false);
    });
  }

  if (saved) {
    return (
      <button
        onClick={() => setOpen(o => !o)}
        className="text-amber-400 hover:text-amber-300 transition text-[11px] leading-none"
        title={`Alert set for ${teamName}`}
      >
        🔔
        {open && (
          <span
            className="ml-1.5 text-zinc-500 hover:text-red-400 transition"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          >
            remove
          </span>
        )}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-zinc-700 hover:text-zinc-400 transition text-[11px] leading-none"
          title={`Set price alert for ${teamName}`}
        >
          🔔
        </button>
      ) : (
        <span className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <span className="text-zinc-600 text-[10px]">alert $</span>
          <input
            type="number"
            step="0.05"
            min="1.01"
            max="100"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
            className="w-14 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-200 ring-1 ring-zinc-700 focus:outline-none focus:ring-amber-500"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={pending}
            className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
          >
            {pending ? "…" : "Set"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-600 hover:text-zinc-400 text-[10px]"
          >
            ✕
          </button>
        </span>
      )}
    </span>
  );
}
