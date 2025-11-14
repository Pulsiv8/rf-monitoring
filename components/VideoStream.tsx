"use client";
import { useEffect, useRef, useState } from "react";
import mpegts from "mpegts.js";

type Props = {
  camIdx: number;
  showNum: number;
  mode: string;
  cameraName: string;
};

const RES_MAP = {
  VGA: { label: "640×480", size: "640x480" },
  HD: { label: "1280×720", size: "1280x720" },
  FHD: { label: "1920×1080", size: "1920x1080" },
  "4K": { label: "3840×2160", size: "3840x2160" },
} as const;

export default function VideoStream({
  camIdx,
  showNum,
  mode,
  cameraName,
}: Props) {
  /* UI state */
  const [resKey, setResKey] = useState<keyof typeof RES_MAP>("HD");
  const [fps, setFps] = useState(5);
  const [reloadKey, setReloadKey] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [kbps, setKbps] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastMetricsUpdate, setLastMetricsUpdate] = useState<Date | null>(null);
  const [metricsConnectionStatus, setMetricsConnectionStatus] = useState<
    "connecting" | "connected" | "error" | "disconnected"
  >("disconnected");

  // kbpsの安全な取得関数
  const getSafeKbps = (): number | null => {
    if (
      kbps !== null &&
      kbps !== undefined &&
      typeof kbps === "number" &&
      !isNaN(kbps)
    ) {
      return kbps;
    }
    return null;
  };

  /* refs */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<mpegts.Player | null>(null);

  /* build stream URL */
  const url = `/api/stream?cam=${camIdx}&res=${RES_MAP[resKey].size}&fps=${fps}&mode=${mode}&cb=${reloadKey}`;

  // デバッグ用: カメラ情報をログ出力
  useEffect(() => {
    console.log(
      `VideoStream初期化: camIdx=${camIdx}, cameraName="${cameraName}", mode=${mode}, url=${url}`
    );
  }, [camIdx, cameraName, mode, url]);

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

    // プレイヤーが準備完了してからrefを設定
    player.on(mpegts.Events.MEDIA_INFO, () => {
      playerRef.current = player;
      setIsLoading(false);
      setLastError(null);
    });

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
    let es: EventSource | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000;

    const connectMetrics = () => {
      try {
        // 既存の接続を閉じる
        if (es) {
          es.close();
        }

        setMetricsConnectionStatus("connecting");
        const metricsUrl = `/api/metrics?cam=${camIdx}&mode=${mode}&cb=${Date.now()}`;
        // console.log(`カメラ ${camIdx} メトリクス接続開始:`, metricsUrl);

        es = new EventSource(metricsUrl);

        es.onopen = () => {
          // console.log(`カメラ ${camIdx} メトリクス接続成功`);
          retryCount = 0; // 接続成功時はリトライカウントをリセット
          setLastError(null);
          setMetricsConnectionStatus("connected");
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            // console.log(`カメラ ${camIdx} メトリクス受信:`, {
            //   receivedData: data,
            //   currentCamIdx: camIdx,
            //   dataCamIdx: data.cam,
            //   isMatch: data.cam === camIdx,
            //   kbps: data.kbps,
            //   timestamp: data.timestamp,
            // });

            if (data.error) {
              console.error(`カメラ ${camIdx} メトリクスエラー:`, data.error);
              setLastError(`メトリクスエラー: ${data.error}`);
              setMetricsConnectionStatus("error");
            } else if (data.cam === camIdx) {
              // カメラIDが一致する場合のみ更新
              if (
                data.kbps !== undefined &&
                data.kbps !== null &&
                typeof data.kbps === "number" &&
                !isNaN(data.kbps)
              ) {
                // console.log(`カメラ ${camIdx} メトリクス更新成功:`, {
                //   oldKbps: kbps,
                //   newKbps: data.kbps,
                //   diff: data.kbps - (kbps || 0),
                //   debug: data.debug,
                // });

                setKbps(data.kbps);
                setLastMetricsUpdate(new Date()); // メトリクス更新時刻を更新
                setLastError(null);
                setMetricsConnectionStatus("connected");
              } else {
                console.warn(`カメラ ${camIdx} 無効なkbps値:`, data.kbps);
                setLastError(`無効なメトリクス値: ${data.kbps}`);
                setMetricsConnectionStatus("error");
              }
            } else {
              console.warn(
                `カメラ ${camIdx} メトリクスID不一致:`,
                data.cam,
                "!=",
                camIdx
              );
            }
          } catch (error) {
            console.error(`カメラ ${camIdx} メトリクス解析エラー:`, error);
            setLastError(`メトリクス解析エラー`);
            setMetricsConnectionStatus("error");
          }
        };

        es.onerror = (error) => {
          console.error(`カメラ ${camIdx} メトリクス接続エラー:`, error);
          setLastError(`メトリクス接続エラー`);
          setMetricsConnectionStatus("error");

          // 接続エラー時のリトライ処理
          if (retryCount < maxRetries) {
            retryCount++;
            // console.log(
            //   `カメラ ${camIdx} メトリクス再接続試行 ${retryCount}/${maxRetries}`
            // );
            setTimeout(connectMetrics, retryDelay);
          } else {
            console.error(
              `カメラ ${camIdx} メトリクス接続失敗: 最大リトライ回数に達しました`
            );
            setLastError(`メトリクス接続失敗 (リトライ上限)`);
            setMetricsConnectionStatus("error");
          }
        };
      } catch (error) {
        console.error(`カメラ ${camIdx} メトリクス接続作成エラー:`, error);
        setLastError(`メトリクス接続作成エラー`);
        setMetricsConnectionStatus("error");
      }
    };

    // 初回接続
    connectMetrics();

    // クリーンアップ
    return () => {
      if (es) {
        // console.log(`カメラ ${camIdx} メトリクス接続終了`);
        es.close();
      }
    };
  }, [camIdx, mode]);

  /* force reload handler */
  const forceReload = () => {
    setIsLoading(true);
    setReloadKey(Date.now());
    setLastError(null);
  };

  /* debug handler */
  // const showDebugInfo = async () => {
  //   try {
  //     const response = await fetch("/api/debug");
  //     const data = await response.json();
  //     console.log("デバッグ情報:", data);
  //     alert(
  //       `デバッグ情報をコンソールに出力しました。\nモード: ${data.environment.CAMERA_MODE}\nカメラ数: ${data.environment.NEXT_PUBLIC_CAMERA_COUNT}`
  //     );
  //   } catch (error) {
  //     console.error("デバッグ情報の取得に失敗:", error);
  //     alert("デバッグ情報の取得に失敗しました");
  //   }
  // };

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
        width: "100%",
        minWidth: "300px",
        maxWidth: showNum === 1 ? "600px" : "100%",
        height: "fit-content",
        boxSizing: "border-box",
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
        {/* カメラ名称オーバーレイ */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            zIndex: 10,
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {cameraName}
        </div>

        {/* メトリクス接続状態インジケーター */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background:
              metricsConnectionStatus === "connected" && getSafeKbps() !== null
                ? "rgba(40, 167, 69, 0.8)"
                : metricsConnectionStatus === "connecting"
                ? "rgba(0, 123, 255, 0.8)"
                : metricsConnectionStatus === "error"
                ? "rgba(220, 53, 69, 0.8)"
                : "rgba(108, 117, 125, 0.8)",
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "500",
            zIndex: 10,
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {metricsConnectionStatus === "connected" && getSafeKbps() !== null
            ? "● 接続中"
            : metricsConnectionStatus === "connecting"
            ? "○ 接続中"
            : metricsConnectionStatus === "error"
            ? "× 接続エラー"
            : "○ 接続待機"}
        </div>

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
            transform: "rotate(180deg)",
          }}
          onWaiting={() => {
            setIsLoading(true);
            /* 2 s 以上止まったら追い越す */
            setTimeout(() => {
              const p = playerRef.current;
              try {
                if (
                  p &&
                  p.buffered &&
                  p.buffered.length > 0 &&
                  p.currentTime - p.buffered.end(0) > 1
                ) {
                  p.currentTime = p.buffered.end(0) - 0.1;
                }
              } catch (error) {
                console.warn(`カメラ ${camIdx} バッファ操作エラー:`, error);
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

        {/* debug */}
        {/* <button
          onClick={showDebugInfo}
          style={btnStyle("#6f42c1", "#6f42c1")}
          onMouseEnter={(e) => hoverBtn(e, "#5a32a3")}
          onMouseLeave={(e) => hoverBtn(e, "#6f42c1")}
          title="デバッグ情報を表示"
        >
          🐛
        </button> */}

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
          fontSize: "16px",
          color: "#495057",
          padding: "12px 16px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
          fontWeight: "500",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span>カメラ {camIdx + 1}</span>
          <span style={{ fontSize: "14px", color: "#6c757d" }}>
            {RES_MAP[resKey].label} / {fps}fps
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            {metricsConnectionStatus === "connected" &&
            getSafeKbps() !== null ? (
              <span style={{ color: "#28a745", fontWeight: "600" }}>
                実測: {getSafeKbps()!.toFixed(1)} kbps
              </span>
            ) : metricsConnectionStatus === "connecting" ? (
              <span style={{ color: "#007bff", fontStyle: "italic" }}>
                メトリクス接続中...
              </span>
            ) : metricsConnectionStatus === "error" ? (
              <span style={{ color: "#dc3545", fontStyle: "italic" }}>
                メトリクス接続エラー
              </span>
            ) : (
              <span style={{ color: "#6c757d", fontStyle: "italic" }}>
                メトリクス未接続
              </span>
            )}
          </span>

          {lastMetricsUpdate && (
            <span style={{ fontSize: "12px", color: "#6c757d" }}>
              更新: {lastMetricsUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* デバッグ情報表示（開発時のみ） */}
        {process.env.NODE_ENV === "development" && kbps !== null && (
          <div
            style={{
              fontSize: "10px",
              color: "#6c757d",
              marginTop: "4px",
              padding: "4px 8px",
              background: "#f8f9fa",
              borderRadius: "4px",
              border: "1px solid #e9ecef",
            }}
          >
            <div>カメラID: {camIdx}</div>
            <div>モード: {mode}</div>
            <div>接続状態: {metricsConnectionStatus}</div>
            <div>kbps: {kbps}</div>
          </div>
        )}

        {lastError && (
          <div
            style={{
              fontSize: "12px",
              color: "#dc3545",
              marginTop: "8px",
              padding: "4px 8px",
              background: "#f8d7da",
              borderRadius: "4px",
              border: "1px solid #f5c6cb",
            }}
          >
            ⚠️ {lastError}
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
