"use client";
import { useState, useEffect, useMemo } from "react";

type Props = { camIdx: number; showNum: number };

const RES_MAP = {
  VGA: { label: "VGA", size: "640x480" },
  HD: { label: "HD", size: "1280x720" },
  FHD: { label: "FHD", size: "1920x1080" },
} as const;

export default function VideoStream({ camIdx, showNum }: Props) {
  const [resKey, setResKey] = useState<keyof typeof RES_MAP>("HD");
  const [fps, setFps] = useState(5);
  const [cb, setCb] = useState(Date.now());
  const [kbps, setKbps] = useState<number | null>(null);
  const [iperf, setIperf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);

  const src = `/api/stream?cam=${camIdx}&res=${RES_MAP[resKey].size}&fps=${fps}&cb=${cb}`;

  /* reload on param change */
  useEffect(() => setCb(Date.now()), [resKey, fps, camIdx]);

  /* 強制更新関数 */
  const forceReload = () => {
    setIsLoading(true);
    const newCb = Date.now();
    setCb(newCb);

    // 画像要素を強制的に再読み込み
    if (imgRef) {
      imgRef.src = `/api/stream?cam=${camIdx}&res=${RES_MAP[resKey].size}&fps=${fps}&cb=${newCb}`;
    }

    // ローディング状態をリセット
    setTimeout(() => setIsLoading(false), 1000);
  };

  /* ── SSE for kbps ────────────────────── */
  useEffect(() => {
    const es = new EventSource(`/api/metrics?cam=${camIdx}`);
    es.onmessage = (e) => {
      const { kbps } = JSON.parse(e.data);
      setKbps(kbps);
    };
    return () => es.close();
  }, [camIdx]);

  /* ── iPerf launcher ─────────────────── */
  const runIperf = async () => {
    setIperf("測定中…");
    try {
      const r = await fetch(`/api/iperf?cam=${camIdx}`);
      const j = await r.json();
      if (j.end?.sum_sent?.bits_per_second) {
        const mbps = (j.end.sum_sent.bits_per_second / 1_000_000).toFixed(2);
        setIperf(`iPerf ≈ ${mbps} Mbps`);
      } else {
        setIperf("iPerf エラー");
      }
    } catch {
      setIperf("iPerf 実行失敗");
    }
    setTimeout(() => setIperf(null), 10_000);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "12px",
        border: "1px solid #e9ecef",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        width: showNum === 1 ? "80%" : "100%",
        minWidth: "300px",
        ...(showNum === 1 && {
          maxWidth: "1200px",
          margin: "0 auto",
        }),
      }}
    >
      {/* stream box */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: "#000",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          position: "relative",
        }}
      >
        <img
          id={`cam${camIdx}`}
          ref={setImgRef}
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: isLoading ? 0.7 : 1,
            transition: "opacity 0.3s ease",
          }}
          alt={`cam${camIdx}`}
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              fontSize: "18px",
              fontWeight: "500",
              zIndex: 1,
            }}
          >
            更新中...
          </div>
        )}
      </div>

      {/* controls */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          fontSize: "20px",
          alignItems: "center",
        }}
      >
        <select
          value={resKey}
          onChange={(e) => setResKey(e.target.value as keyof typeof RES_MAP)}
          style={{
            fontSize: "20px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "2px solid #dee2e6",
            backgroundColor: "white",
            cursor: "pointer",
            outline: "none",
            transition: "border-color 0.2s ease",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#007bff")}
          onBlur={(e) => (e.target.style.borderColor = "#dee2e6")}
        >
          {Object.keys(RES_MAP).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          max={30}
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
          style={{
            width: "70px",
            fontSize: "20px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "2px solid #dee2e6",
            backgroundColor: "white",
            outline: "none",
            transition: "border-color 0.2s ease",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#007bff")}
          onBlur={(e) => (e.target.style.borderColor = "#dee2e6")}
        />

        <button
          onClick={forceReload}
          disabled={isLoading}
          style={{
            fontSize: "20px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "2px solid #007bff",
            backgroundColor: isLoading ? "#6c757d" : "#007bff",
            color: "white",
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            minWidth: "44px",
            opacity: isLoading ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = "#0056b3";
              e.currentTarget.style.borderColor = "#0056b3";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = "#007bff";
              e.currentTarget.style.borderColor = "#007bff";
            }
          }}
        >
          {isLoading ? "⏳" : "🔄"}
        </button>
        <button
          onClick={() =>
            document.getElementById(`cam${camIdx}`)!.requestFullscreen?.()
          }
          style={{
            fontSize: "20px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "2px solid #28a745",
            backgroundColor: "#28a745",
            color: "white",
            cursor: "pointer",
            transition: "all 0.2s ease",
            minWidth: "44px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1e7e34";
            e.currentTarget.style.borderColor = "#1e7e34";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#28a745";
            e.currentTarget.style.borderColor = "#28a745";
          }}
        >
          ⛶
        </button>
        <button
          onClick={runIperf}
          style={{
            fontSize: "20px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "2px solid #ffc107",
            backgroundColor: "#ffc107",
            color: "#212529",
            cursor: "pointer",
            transition: "all 0.2s ease",
            fontWeight: "500",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#e0a800";
            e.currentTarget.style.borderColor = "#e0a800";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ffc107";
            e.currentTarget.style.borderColor = "#ffc107";
          }}
        >
          ⚡ iPerf
        </button>
      </div>

      {/* info */}
      <div
        style={{
          fontSize: "24px",
          color: "#495057",
          padding: "12px 16px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
          fontWeight: "500",
        }}
      >
        {kbps !== null ? `実測: ${kbps.toFixed(1)} kbps` : "―"}{" "}
        {iperf && `| ${iperf}`}
      </div>
    </div>
  );
}
