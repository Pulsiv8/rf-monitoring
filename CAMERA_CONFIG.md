# カメラ設定ガイド

## 重要: 映像ストリームと名称の順序について

**カメラ名称の順序は、映像ストリームの順序と完全に一致する必要があります。**

- `camIdx=0` → 1 番目の名称
- `camIdx=1` → 2 番目の名称
- `camIdx=2` → 3 番目の名称
- ...

## 環境変数の設定

### カメラ数設定

```bash
# LOCALモードでのカメラ数
NEXT_PUBLIC_CAMERA_COUNT_LOCAL=4

# GLOBALモードでのカメラ数
NEXT_PUBLIC_CAMERA_COUNT_GLOBAL=8
```

### カメラ名称設定

```bash
# LOCALモードでのカメラ名称（カンマ区切り）
NEXT_PUBLIC_CAMERA_NAMES_LOCAL="メインカメラ,サブカメラ,エントランス,駐車場"

# GLOBALモードでのカメラ名称（カンマ区切り）
NEXT_PUBLIC_CAMERA_NAMES_GLOBAL="本社正面,本社裏口,倉庫A,倉庫B,駐車場A,駐車場B,エントランス,受付"
```

### 設定例

#### LOCAL モード（4 カメラ）

```bash
NEXT_PUBLIC_CAMERA_COUNT_LOCAL=4
NEXT_PUBLIC_CAMERA_NAMES_LOCAL="メインカメラ,サブカメラ,エントランス,駐車場"
```

**映像ストリームとの対応:**

- メインカメラ → `/api/stream?cam=0&mode=LOCAL`
- サブカメラ → `/api/stream?cam=1&mode=LOCAL`
- エントランス → `/api/stream?cam=2&mode=LOCAL`
- 駐車場 → `/api/stream?cam=3&mode=LOCAL`

#### GLOBAL モード（8 カメラ）

```bash
NEXT_PUBLIC_CAMERA_COUNT_GLOBAL=8
NEXT_PUBLIC_CAMERA_NAMES_GLOBAL="本社正面,本社裏口,倉庫A,倉庫B,駐車場A,駐車場B,エントランス,受付"
```

**映像ストリームとの対応:**

- 本社正面 → `/api/stream?cam=0&mode=GLOBAL`
- 本社裏口 → `/api/stream?cam=1&mode=GLOBAL`
- 倉庫 A → `/api/stream?cam=2&mode=GLOBAL`
- 倉庫 B → `/api/stream?cam=3&mode=GLOBAL`
- 駐車場 A → `/api/stream?cam=4&mode=GLOBAL`
- 駐車場 B → `/api/stream?cam=5&mode=GLOBAL`
- エントランス → `/api/stream?cam=6&mode=GLOBAL`
- 受付 → `/api/stream?cam=7&mode=GLOBAL`

## 注意事項

1. **カメラ数と名称の一致**: カメラ数と名称の数は一致させる必要があります
2. **順序の重要性**: 名称の順序は映像ストリームの順序と完全に一致する必要があります
3. **文字エンコーディング**: 日本語名称を使用する場合は、適切な文字エンコーディングを設定してください
4. **スペース**: 名称にスペースが含まれる場合は、そのまま設定可能です
5. **特殊文字**: カンマ（,）は区切り文字として使用されるため、名称に含めないでください

## デバッグ機能

設定後、ブラウザの開発者ツールのコンソールで以下が確認できます：

- カメラ数と名称数の一致チェック
- 各 VideoStream コンポーネントの初期化情報
- 映像ストリーム URL とカメラ名称の対応関係

## デフォルト動作

環境変数が設定されていない場合：

- カメラ数: 1
- カメラ名称: "Camera 1", "Camera 2", ... のように自動生成されます
