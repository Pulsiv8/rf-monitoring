# RF Monitoring System

カメラからのライブストリーミングを表示するシステムです。

## 環境変数の設定

`.env.local`ファイルを作成し、以下の設定を行ってください：

### 基本設定

```bash
# カメラの認証情報
CAMERA_USERNAME=your_camera_username
CAMERA_PASSWORD=your_camera_password

# ストリームプロファイル（カンマ区切りで複数指定可能）
CAMERA_STREAM_PROFILES=quality,quality

# 表示するカメラ数
NEXT_PUBLIC_CAMERA_COUNT=2
```

### モード設定

```bash
# カメラモード（GLOBAL または LOCAL）
CAMERA_MODE=GLOBAL
```

### GLOBAL モード（外部ネットワーク）

```bash
# 外部ネットワーク上のカメラIPアドレス（カンマ区切り）
CAMERA_RTSP_HOSTS_GLOBAL=203.0.113.100,203.0.113.101

# RTSPポート（カンマ区切り、通常は554）
CAMERA_RTSP_PORTS_GLOBAL=554,554
```

### LOCAL モード（ローカルネットワーク）

```bash
# ローカルネットワーク上のカメラIPアドレス（カンマ区切り）
CAMERA_RTSP_HOSTS_LOCAL=192.168.1.100,192.168.1.101

# RTSPポート（カンマ区切り、通常は554）
CAMERA_RTSP_PORTS_LOCAL=554,554
```

## 使用方法

1. 環境変数を設定
2. アプリケーションを起動
3. ブラウザでアクセス
4. モードに応じたカメラから映像を表示

## モード切り替え

`CAMERA_MODE`環境変数を変更することで、GLOBAL モードと LOCAL モードを切り替えることができます：

- `CAMERA_MODE=GLOBAL` → 外部ネットワークのカメラを使用
- `CAMERA_MODE=LOCAL` → ローカルネットワークのカメラを使用

## 注意事項

- FFmpeg がサーバーにインストールされている必要があります
- カメラが RTSP プロトコルをサポートしている必要があります
- ファイアウォールで RTSP ポート（通常 554）が開放されている必要があります
- カメラの認証情報が正しく設定されている必要があります
