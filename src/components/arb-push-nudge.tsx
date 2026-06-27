"use client";

import { useState, useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) buffer[i] = rawData.charCodeAt(i);
  return buffer.buffer;
}

export function ArbPushNudge() {
  const [show, setShow] = useState(false);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;
    if (localStorage.getItem("push_nudge_dismissed")) return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Delay slightly so the user sees the arbs first
        setTimeout(() => setShow(true), 2500);
      }
    });
  }, []);

  async function enable() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const json = sub.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      setDone(true);
      localStorage.setItem("push_nudge_dismissed", "1");
    } catch {
      // ignore
    } finally {
      setWorking(false);
    }
  }

  function dismiss() {
    setShow(false);
    localStorage.setItem("push_nudge_dismissed", "1");
  }

  if (!show) return null;

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        Alerts enabled — you&apos;ll get a notification the next time an arb appears.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 animate-in fade-in duration-500">
      <div>
        <p className="text-sm font-medium text-amber-300">Arb windows close in seconds</p>
        <p className="text-xs text-zinc-500 mt-0.5">Enable alerts and get notified the instant one opens</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={enable}
          disabled={working}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {working ? "…" : "Alert me →"}
        </button>
        <button onClick={dismiss} className="text-xs text-zinc-600 hover:text-zinc-400">✕</button>
      </div>
    </div>
  );
}
