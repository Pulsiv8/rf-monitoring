# Axis Camera Monitor

Axis カメラのライブストリーミングを表示する Next.js アプリケーションです。

## 機能

- グローバル IP アドレス経由での Axis カメラアクセス
- 現在のネットワークとカメラのネットワークを自動判定
- VAPIX API を使用したライブストリーミング
- フルスクリーン表示対応
- リアルタイム映像更新

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定してください：

```bash
# カメラのグローバルIPアドレス
NEXT_PUBLIC_CAMERA_GLOBAL_IP=153.134.16.130

# カメラのローカルIPアドレス
NEXT_PUBLIC_CAMERA_LOCAL_IP=192.168.11.43

# カメラ認証情報
CAMERA_USERNAME=root
CAMERA_PASSWORD=SOUMU-RF-1
```

詳細な設定方法は `ENV_EXAMPLE.md` を参照してください。

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認してください。

## 動作仕様

1. **現在のネットワークのグローバル IP アドレスを取得**

   - 外部 API を使用して現在のネットワークのグローバル IP アドレスを取得

2. **接続方法の決定**

   - 現在のグローバル IP アドレス = カメラのグローバル IP アドレスの場合
     → カメラのローカル IP アドレスに直接アクセス
   - 現在のグローバル IP アドレス ≠ カメラのグローバル IP アドレスの場合
     → カメラのグローバル IP アドレスを経由してローカル IP アドレスにアクセス

3. **VAPIX API による映像取得**
   - `/axis-cgi/mjpg/video.cgi` を使用してライブストリーミングを取得
   - Basic 認証を使用

## 技術スタック

- [Next.js](https://nextjs.org/) - React フレームワーク
- TypeScript - 型安全な開発
- VAPIX API - Axis カメラ制御

## トラブルシューティング

接続に問題がある場合は、以下を確認してください：

- カメラの IP アドレスが正しく設定されているか
- ファイアウォールの設定
- カメラの認証情報
- VAPIX API が有効になっているか

詳細は `ENV_EXAMPLE.md` のトラブルシューティングセクションを参照してください。
