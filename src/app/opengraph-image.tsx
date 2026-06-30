import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EdgeBoard — NRL odds intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 90px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Amber accent bar */}
        <div style={{ width: 56, height: 5, background: "#f59e0b", borderRadius: 3, marginBottom: 36 }} />

        {/* Wordmark */}
        <div style={{ fontSize: 80, fontWeight: 700, color: "#ffffff", letterSpacing: "-3px", marginBottom: 20 }}>
          EdgeBoard
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 30, color: "#71717a", fontWeight: 400, marginBottom: 52 }}>
          NRL odds · arbs · EV across 11 bookmakers
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 14 }}>
          {["Odds Board", "Arb Finder", "EV Calculator", "Line Movement"].map((f) => (
            <div
              key={f}
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 10,
                padding: "10px 20px",
                color: "#a1a1aa",
                fontSize: 20,
              }}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{ position: "absolute", bottom: 56, right: 90, color: "#3f3f46", fontSize: 22 }}>
          yo-bets.vercel.app
        </div>
      </div>
    ),
    { ...size },
  );
}
