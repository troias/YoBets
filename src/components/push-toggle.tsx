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

export function PushToggle() {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed">("loading");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "unsubscribed");
    });
  }, []);

  async function subscribe() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });

      setState("subscribed");
    } catch (err) {
      console.error("Push subscribe error:", err);
    } finally {
      setWorking(false);
    }
  }

  async function unsubscribe() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setWorking(false);
    }
  }

  if (state === "loading") return null;

  if (state === "unsupported") {
    return <p className="text-xs text-zinc-600">Push notifications are not supported in this browser.</p>;
  }

  if (state === "denied") {
    return <p className="text-xs text-amber-600">Notifications blocked — enable them in browser settings and reload.</p>;
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-zinc-200">Browser push notifications</p>
        <p className="text-xs text-zinc-500">
          {state === "subscribed"
            ? "Arb and steam alerts will appear as browser notifications"
            : "Get instant alerts in your browser without checking email"}
        </p>
      </div>
      <button
        type="button"
        onClick={state === "subscribed" ? unsubscribe : subscribe}
        disabled={working}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          state === "subscribed"
            ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            : "bg-green-600 text-white hover:bg-green-500"
        }`}
      >
        {working ? "..." : state === "subscribed" ? "Disable" : "Enable"}
      </button>
    </div>
  );
}
