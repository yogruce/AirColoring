#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Antigravity Air Coloring Pro - Kurulum & Baslat ==="

if ! command -v node >/dev/null 2>&1; then
  echo "[HATA] Node.js bulunamadi. Lutfen Node.js 18+ kurun: https://nodejs.org"
  exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "[OK] .env olusturuldu (istege bagli GEMINI_API_KEY ekleyebilirsiniz)."
fi

if [ ! -d "node_modules" ]; then
  echo "[1/2] Bagimliliklar yukleniyor..."
  npm install
fi

if [ ! -f "dist/index.html" ]; then
  echo "[2/2] Uretim paketi derleniyor..."
  npm run build
fi

(
  sleep 2
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3001" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:3001" || true
  fi
) &

echo "[BASLATILIYOR] http://localhost:3001"
NODE_ENV=production exec ./node_modules/.bin/tsx server/index.ts
