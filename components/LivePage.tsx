"use client";
import dynamic from "next/dynamic";
import { useState } from "react";

const VideoStream = dynamic(() => import("@/components/VideoStream"), {
  ssr: false,
});

const TOTAL = Number(process.env.NEXT_PUBLIC_CAMERA_COUNT || 1);

export default function LivePage() {
  const [showNum, setShowNum] = useState(1);

  /* 動的グリッド列数 */
  const cols =
    showNum === 1
      ? 1
      : showNum === 2
      ? 2
      : showNum <= 4
      ? 2
      : Math.ceil(Math.sqrt(showNum));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        padding: "2rem",
      }}
    >
      <header
        style={{
          textAlign: "center",
          marginBottom: "1rem",
          fontWeight: 600,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.4rem",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: "2rem" }}>Farm Monitoring System</h1>
        <select
          value={showNum}
          onChange={(e) => setShowNum(Number(e.target.value))}
          style={{
            fontSize: "1.4rem",
            padding: "0.2rem 0.4rem",
            marginLeft: "0.4rem",
            background: "white",
            borderRadius: "0.4rem",
            border: "none",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            cursor: "pointer",
          }}
        >
          {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} 画面
            </option>
          ))}
        </select>
      </header>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {Array.from({ length: showNum }, (_, idx) => (
          <VideoStream key={idx} camIdx={idx % TOTAL} showNum={showNum} />
        ))}
      </div>
    </div>
  );
}
