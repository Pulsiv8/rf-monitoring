"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const VideoStream = dynamic(() => import("@/components/VideoStream"), {
  ssr: false,
});

export default function LivePage() {
  const [showNum, setShowNum] = useState(1);
  const [mode, setMode] = useState<string>("GLOBAL");
  const [availableModes, setAvailableModes] = useState<string[]>([
    "LOCAL",
    "GLOBAL",
  ]);

  // モード情報を取得
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const response = await fetch("/api/mode");
        const data = await response.json();
        setMode(data.mode);
        setAvailableModes(data.availableModes || ["LOCAL", "GLOBAL"]);
      } catch (error) {
        console.warn("モード情報の取得に失敗:", error);
        setMode("GLOBAL");
        setAvailableModes(["LOCAL", "GLOBAL"]);
      }
    };
    fetchMode();
  }, []);

  const TOTAL =
    mode === "LOCAL"
      ? Number(process.env.NEXT_PUBLIC_CAMERA_COUNT_LOCAL || 1)
      : Number(process.env.NEXT_PUBLIC_CAMERA_COUNT_GLOBAL || 1);

  // モード変更ハンドラー
  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    // モード変更時にカメラを再読み込み
    setShowNum(showNum); // 強制的に再レンダリング
  };

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
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
          </div>
          {/* モード選択 */}
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            style={{
              fontSize: "1rem",
              padding: "0.3rem 0.8rem",
              background: mode === "LOCAL" ? "#28a745" : "#007bff",
              color: "white",
              borderRadius: "20px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              border: "none",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {availableModes.map((m) => (
              <option
                key={m}
                value={m}
                style={{ background: "#fff", color: "#333" }}
              >
                {m} Mode
              </option>
            ))}
          </select>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {Array.from({ length: showNum }, (_, idx) => (
          <VideoStream
            key={`${mode}-${idx}`}
            camIdx={idx % TOTAL}
            showNum={showNum}
            mode={mode}
          />
        ))}
      </div>
    </div>
  );
}
