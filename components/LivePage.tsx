"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const VideoStream = dynamic(() => import("@/components/VideoStream"), {
  ssr: false,
});

export default function LivePage() {
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

  // カメラ名称を取得
  const getCameraNames = () => {
    if (mode === "LOCAL") {
      const names = process.env.NEXT_PUBLIC_CAMERA_NAMES_LOCAL;
      if (names) {
        const nameArray = names.split(",").map((name) => name.trim());
        // 配列の長さがカメラ数と一致するかチェック
        if (nameArray.length !== TOTAL) {
          console.warn(
            `LOCALモード: カメラ名称数(${nameArray.length}) とカメラ数(${TOTAL}) が一致しません`
          );
        }
        return nameArray;
      }
    } else {
      const names = process.env.NEXT_PUBLIC_CAMERA_NAMES_GLOBAL;
      if (names) {
        const nameArray = names.split(",").map((name) => name.trim());
        // 配列の長さがカメラ数と一致するかチェック
        if (nameArray.length !== TOTAL) {
          console.warn(
            `GLOBALモード: カメラ名称数(${nameArray.length}) とカメラ数(${TOTAL}) が一致しません`
          );
        }
        return nameArray;
      }
    }
    // デフォルトの名称
    return Array.from({ length: TOTAL }, (_, i) => `Camera ${i + 1}`);
  };

  const cameraNames = getCameraNames();

  // デバッグ用: カメラ名称とインデックスの対応をログ出力
  useEffect(() => {
    console.log(`${mode}モード - カメラ設定:`, {
      total: TOTAL,
      names: cameraNames,
      namesLength: cameraNames.length,
    });
  }, [mode, TOTAL, cameraNames]);

  // モード変更ハンドラー
  const handleModeChange = (newMode: string) => {
    setMode(newMode);
  };

  /* 動的グリッド列数の自動調整 */
  const getGridLayout = (cameraCount: number) => {
    // 画面サイズを考慮したレスポンシブ対応
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const isTablet = typeof window !== "undefined" && window.innerWidth < 1024;

    if (isMobile) {
      // モバイルの場合は縦並び
      return { cols: 1, rows: cameraCount };
    }

    if (isTablet) {
      // タブレットの場合は最大2列
      if (cameraCount <= 2) return { cols: cameraCount, rows: 1 };
      if (cameraCount <= 4)
        return { cols: 2, rows: Math.ceil(cameraCount / 2) };
      return { cols: 2, rows: Math.ceil(cameraCount / 2) };
    }

    // デスクトップの場合
    if (cameraCount === 1) return { cols: 1, rows: 1 };
    if (cameraCount === 2) return { cols: 2, rows: 1 };
    if (cameraCount === 3) return { cols: 3, rows: 1 };
    if (cameraCount === 4) return { cols: 2, rows: 2 };
    if (cameraCount === 5 || cameraCount === 6) return { cols: 3, rows: 2 };
    if (cameraCount === 7 || cameraCount === 8) return { cols: 4, rows: 2 };
    if (cameraCount === 9) return { cols: 3, rows: 3 };
    if (cameraCount === 10 || cameraCount === 12) return { cols: 4, rows: 3 };
    if (cameraCount === 11) return { cols: 4, rows: 3 };
    if (cameraCount === 13 || cameraCount === 14) return { cols: 4, rows: 4 };
    if (cameraCount === 15 || cameraCount === 16) return { cols: 4, rows: 4 };

    // それ以上の場合は、アスペクト比を考慮して調整
    if (typeof window !== "undefined") {
      const aspectRatio = window.innerWidth / window.innerHeight;
      if (aspectRatio > 1.5) {
        // 横長の画面の場合、列数を多くする
        const cols = Math.ceil(Math.sqrt(cameraCount * aspectRatio));
        const rows = Math.ceil(cameraCount / cols);
        return { cols, rows };
      }
    }

    // デフォルトの計算
    const cols = Math.ceil(Math.sqrt(cameraCount));
    const rows = Math.ceil(cameraCount / cols);
    return { cols, rows };
  };

  const { cols, rows } = getGridLayout(TOTAL);

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
            <span
              style={{
                fontSize: "1.2rem",
                padding: "0.3rem 0.8rem",
                background: "#6c757d",
                color: "white",
                borderRadius: "20px",
                fontWeight: "500",
                marginLeft: "0.4rem",
              }}
            >
              {TOTAL} カメラ
            </span>
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
          gridTemplateColumns: TOTAL === 1 ? "1fr" : `repeat(${cols}, 1fr)`,
          gridTemplateRows:
            TOTAL === 1 ? "1fr" : `repeat(${rows}, minmax(auto, 1fr))`,
          maxWidth: TOTAL === 1 ? "800px" : "100%",
          margin: "0 auto",
          alignItems: TOTAL === 1 ? "center" : "start",
          justifyItems: "center",
        }}
      >
        {Array.from({ length: TOTAL }, (_, idx) => (
          <VideoStream
            key={`${mode}-${idx}`}
            camIdx={idx}
            showNum={TOTAL}
            mode={mode}
            cameraName={cameraNames[idx]}
          />
        ))}
      </div>
    </div>
  );
}
