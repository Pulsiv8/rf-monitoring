"use client";
import { useEffect, useRef, useState } from "react";
import mpegts from "mpegts.js";

type Props = { camIdx: number; showNum: number };

const RES_MAP = {
  VGA: { label: "640×480", size: "640x480" },
  HD: { label: "1280×720", size: "1280x720" },
  FHD: { label: "1920×1080", size: "1920x1080" },
  "4K": { label: "3840×2160", size: "3840x2160" },
} as const;

export default function VideoStream({ camIdx, showNum }: Props) {
  /* UI state */
  const [resKey, setResKey] = useState<keyof typeof RES_MAP>("HD");
  const [fps, setFps] = useState(30);
  const [reloadKey, setReloadKey] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [kbps, setKbps] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  /* refs */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<mpegts.Player | null>(null);

  /* build stream URL */
  const url = `/api/stream?cam=${camIdx}&res=${RES_MAP[resKey].size}&fps=${fps}&cb=${reloadKey}`;

  /* initialise mpegts.js */
  useEffect(() => {
    if (!videoRef.current || !mpegts.getFeatureList().mseLivePlayback) return;

    const player = mpegts.createPlayer(
      { type: "mpegts", isLive: true, url },
      {
        enableStashBuffer: false,
        stashInitialSize: 128,
        liveBufferLatencyChasing: true, // 自動追い越し
        liveBufferLatencyMaxLatency: 1.0, // 1 s を超えたら skip
        // liveBufferLatencyMinLatency: 0.3,
      }
    );

    player.attachMediaElement(videoRef.current);
    player.load();

    // play()のPromiseを適切に処理
    const playPromise = player.play();
    if (playPromise !== undefined) {
      playPromise.catch((error: Error) => {
        console.warn(`カメラ ${camIdx} 再生エラー:`, error);
        // AbortErrorは無視（新しいload requestによる中断）
        if (error.name !== "AbortError") {
          setLastError(`再生エラー: ${error.message}`);
        }
      });
    }

    playerRef.current = player;
    setIsLoading(false);
    setLastError(null);

    // エラーハンドリング
    player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
      console.error(
        `カメラ ${camIdx} ストリームエラー:`,
        errorType,
        errorDetail
      );
      setLastError(`${errorType}: ${errorDetail}`);
      setIsLoading(true);
    });

    return () => {
      try {
        player.destroy();
      } catch (error) {
        console.warn(`カメラ ${camIdx} プレイヤー破棄エラー:`, error);
      }
    };
  }, [url, camIdx]);

  /* SSE metrics */
  useEffect(() => {
    const es = new EventSource(`/api/metrics?cam=${camIdx}`);
    es.onmessage = (e) => {
      const { kbps } = JSON.parse(e.data);
      setKbps(kbps);
    };
    return () => es.close();
  }, [camIdx]);

  /* force reload handler */
  const forceReload = () => {
    setIsLoading(true);
    setReloadKey(Date.now());
    setLastError(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "1rem",
        background: "#f8f9fa",
        borderRadius: "12px",
        border: "1px solid #e9ecef",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        width: showNum === 1 ? "80%" : "100%",
        minWidth: "300px",
        ...(showNum === 1 && { maxWidth: "1200px", margin: "0 auto" }),
      }}
    >
      {/* video box */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: "#000",
          borderRadius: "12px",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: isLoading ? 0.7 : 1,
            transition: "opacity .3s",
          }}
          onWaiting={() => {
            setIsLoading(true);
            /* 2 s 以上止まったら追い越す */
            setTimeout(() => {
              const p = playerRef.current;
              if (
                p &&
                p.buffered.length > 0 &&
                p.currentTime - p.buffered.end(0) > 1
              ) {
                p.currentTime = p.buffered.end(0) - 0.1;
              }
            }, 2000);
          }}
          onPlaying={() => setIsLoading(false)}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              color: "#fff",
              fontSize: "18px",
              fontWeight: 500,
            }}
          >
            更新中…
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
        {/* resolution */}
        <select
          value={resKey}
          onChange={(e) => setResKey(e.target.value as keyof typeof RES_MAP)}
          style={selectStyle}
          onFocus={focusBlue}
          onBlur={blurGray}
        >
          {Object.keys(RES_MAP).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>

        {/* fps */}
        <input
          type="number"
          min={1}
          max={30}
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
          style={{ ...selectStyle, width: "70px" }}
          onFocus={focusBlue}
          onBlur={blurGray}
        />

        {/* reload */}
        <button
          onClick={forceReload}
          disabled={isLoading}
          style={btnStyle(isLoading ? "#6c757d" : "#007bff", "#007bff")}
          onMouseEnter={(e) => !isLoading && hoverBtn(e, "#0056b3")}
          onMouseLeave={(e) => !isLoading && hoverBtn(e, "#007bff")}
        >
          {isLoading ? "⏳" : "🔄"}
        </button>

        {/* fullscreen */}
        <button
          onClick={() => videoRef.current?.requestFullscreen?.()}
          style={btnStyle("#28a745", "#28a745")}
          onMouseEnter={(e) => hoverBtn(e, "#1e7e34")}
          onMouseLeave={(e) => hoverBtn(e, "#28a745")}
        >
          ⛶
        </button>
      </div>

      {/* info */}
      <div
        style={{
          fontSize: "24px",
          color: "#495057",
          padding: "12px 16px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
          fontWeight: 500,
        }}
      >
        {kbps !== null ? `実測: ${kbps.toFixed(1)} kbps` : "―"}{" "}
        {lastError && (
          <div style={{ fontSize: "14px", color: "#dc3545", marginTop: "4px" }}>
            エラー: {lastError}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── inline style helpers ─ */
const selectStyle: React.CSSProperties = {
  fontSize: "20px",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "2px solid #dee2e6",
  background: "#fff",
  cursor: "pointer",
  outline: "none",
  transition: "border-color .2s",
};
const focusBlue = (e: React.FocusEvent<HTMLElement>) =>
  (e.currentTarget.style.borderColor = "#007bff");
const blurGray = (e: React.FocusEvent<HTMLElement>) =>
  (e.currentTarget.style.borderColor = "#dee2e6");

const btnStyle = (
  bg: string,
  border: string,
  color = "#fff"
): React.CSSProperties => ({
  fontSize: "20px",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `2px solid ${border}`,
  background: bg,
  color,
  cursor: "pointer",
  transition: "all .2s",
  minWidth: "44px",
});

const hoverBtn = (
  e: React.MouseEvent<HTMLElement>,
  bg: string,
  color = "#fff"
) => {
  e.currentTarget.style.backgroundColor = bg;
  e.currentTarget.style.borderColor = bg;
  e.currentTarget.style.color = color;
};
