import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "20%",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 110, fontWeight: 700, color: "#f59e0b", letterSpacing: "-4px" }}>
          E
        </div>
      </div>
    ),
    { ...size },
  );
}
