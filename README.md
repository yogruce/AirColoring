# Antigravity Air Coloring Pro — AI Air Coloring & Render Studio

Webcam hand-tracking air drawing & dual-canvas AI rendering studio powered by **React**, **MediaPipe HandLandmarker + FaceDetector**, **HTML5 Dual-Canvas**, and **Google Gemini API** (`gemini-2.5-flash-image`), **Fal.ai**, **Replicate**, or **Local ComfyUI** (plus offline Demo Simulation fallback).

> **Türkçe Kılavuz:** Detaylı kurulum, kiosk kullanımı ve sorun giderme adımları için [KULLANIM_KILAVUZU.md](./KULLANIM_KILAVUZU.md) dosyasına bakın.

## Features

- **Mirrored POV Webcam + 21-Landmark Hand Skeleton HUD** (`@mediapipe/tasks-vision`) with frozen-stream auto-recovery & GPU→CPU fallback
- **3 Draw Trigger Modes**:
  - **Bas-Çiz (`touch_hold`, Kiosk Default)**: Hold the on-screen **`BASILI TUT — HAVADA ÇİZ`** touch pad (or `Space`) with one hand while drawing in the air with the other
  - **Pinch Pen (`pinch_pen`)**: Pinch thumb + index to draw, open to hover
  - **1 Finger (`strict_index`)**: Strict extended index finger (3-frame stabilization)
- **Additional Gesture Controls**:
  - **Open Palm (5 Fingers)**: Area eraser
  - **Pinch over UI / 2s Dwell**: Click swatches & buttons or trigger `AI RENDER / TRANSFORM` hands-free
  - **Two-Hand Framing**: Hold both hands in an L-frame for 1.4s to trigger AI Render
- **Anti-Ghost & Beard Protection**: Anatomical hand geometry filter + parallel `FaceDetector` face/chin suppression
- **Dual-Canvas Architecture**:
  - **Layer 1**: Transparent neon visual canvas over mirrored webcam + HUD
  - **Layer 2**: Pure sketch layer (black or inverted white scribble) and **Kişi + Çizim** composite capture, previewable via **Layer 2** drawer
- **4 Curated AI Themes**:
  - `Fotorealistik Gelecek`, `Cyberpunk Neon Sci-Fi`, `Solarpunk Anime (Ghibli)`, `3D Konsept Maket (Octane)`
- **AI Render Pipeline (`/api/render`)**:
  - Google Gemini API (`gemini-2.5-flash-image` / `gemini-2.0-flash-exp-image-generation`)
  - Fal.ai (`flux/dev/image-to-image` & `sdxl-controlnet-union`)
  - Replicate API
  - Local ComfyUI (`127.0.0.1:8188`)
  - Offline Demo Simulation fallback

## Quick Start

```bash
npm install
cp .env.example .env   # Add GEMINI_API_KEY (recommended) or alternative keys
npm run dev
```

Open `http://localhost:5173`.

## Production Build

```bash
npm run typecheck
npm run build
NODE_ENV=production npm start
```
