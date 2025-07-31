axis-sra-viewer/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ api/
│     └─ stream/
│        └─ route.ts            ← Server‑side proxy that tunnels MJPEG
├─ components/
│  └─ VideoStream.tsx           ← Lightweight IMG‑based player
├─ lib/
│  ├─ sra.ts                    ← Builds the remote URL for SRA v2
│  └─ digestFetch.ts            ← Thin wrapper around HTTP‑Digest auth
├─ types/
│  └─ env.d.ts                  ← TypeScript env‑var declarations
├─ .env.local.example           ← Sample secrets (never commit the real one)
├─ next.config.mjs
├─ package.json
└─ README.md
