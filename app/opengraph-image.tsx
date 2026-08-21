import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "RandomSpin - Free Random Draws";
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
          background: "linear-gradient(135deg, #ffffff 0%, #eef5ff 52%, #f6f2ff 100%)",
          color: "#13213a",
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
            border: "24px solid #2563eb",
            boxShadow: "0 0 90px rgba(37,99,235,0.22)"
          }}
        />
        <div style={{ position: "absolute", right: 244, top: 238, fontSize: 62, fontWeight: 900, color: "#2563eb" }}>
          SPIN
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 940, gap: 28 }}>
          <div style={{ color: "#2563eb", fontSize: 30, fontWeight: 900, letterSpacing: 6 }}>RANDOMSPIN</div>
          <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 0.92 }}>FREE RANDOM DRAWS</div>
          <div style={{ color: "#5f6f89", fontSize: 34, fontWeight: 700 }}>Names, numbers, and more</div>
        </div>
      </div>
    ),
    size
  );
}
