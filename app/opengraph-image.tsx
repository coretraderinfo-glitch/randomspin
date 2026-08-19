import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Lucky Spin - Spin Your Luck";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #05060d 0%, #101636 54%, #061827 100%)",
          color: "white",
          fontFamily: "Arial, sans-serif",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 520,
            right: 100,
            top: 58,
            border: "24px solid #f6d98f",
            boxShadow: "0 0 90px rgba(246,217,143,0.32)"
          }}
        />
        <div style={{ position: "absolute", right: 244, top: 238, fontSize: 62, fontWeight: 900, color: "#f6d98f" }}>
          SPIN
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 940, gap: 28 }}>
          <div style={{ color: "#f6d98f", fontSize: 30, fontWeight: 900, letterSpacing: 10 }}>LUCKY SPIN</div>
          <div style={{ fontSize: 106, fontWeight: 900, lineHeight: 0.92 }}>SPIN YOUR LUCK</div>
          <div style={{ color: "#b8c2d8", fontSize: 34, fontWeight: 700 }}>Free online random number wheel</div>
        </div>
      </div>
    ),
    size
  );
}
