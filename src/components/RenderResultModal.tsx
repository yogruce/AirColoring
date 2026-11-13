import React, { useState } from 'react';
import { Download, Eye, Layers, Sparkles, X } from 'lucide-react';
import { getRenderTheme } from '../constants/prompts';
import type { RenderResult } from '../types/app';

interface RenderResultModalProps {
  result: RenderResult | null;
  arOverlayActive: boolean;
  onToggleArOverlay: () => void;
  onClose: () => void;
}

export const RenderResultModal: React.FC<RenderResultModalProps> = ({
  result,
  arOverlayActive,
  onToggleArOverlay,
  onClose,
}) => {
  // Default to 0% sketch overlay so the full AI render is immediately visible
  const [splitPct, setSplitPct] = useState(0);

  React.useEffect(() => {
    setSplitPct(0);
  }, [result?.timestamp]);

  if (!result) return null;
  const activeTheme = getRenderTheme(result.themeId);

  const downloadImage = async (url: string, filename: string) => {
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      return;
    }

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="hud-glass flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-bold text-white">
                  {activeTheme.label} — AI Render Complete
                </h2>
                <span
                  className="rounded-md border border-white/15 px-2 py-0.5 font-mono-hud text-[10px] font-semibold text-white"
                  style={{ backgroundColor: `${activeTheme.accentHex}28` }}
                >
                  {activeTheme.shortLabel.toUpperCase()}
                </span>
                {result.isDemo && (
                  <span className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono-hud text-[10px] font-semibold text-amber-300">
                    DEMO SIMULATION
                  </span>
                )}
              </div>
              <p className="font-mono-hud text-[11px] text-slate-400">
                Provider: {result.provider.toUpperCase()} · Control Weight: {result.controlWeight} ·{' '}
                {(result.durationMs / 1000).toFixed(2)}s
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Interactive Split Comparison Canvas */}
        <div className="relative flex-1 overflow-hidden bg-slate-950 p-4">
          <div className="relative mx-auto aspect-video max-h-[58vh] w-full overflow-hidden rounded-xl border border-cyan-500/30 bg-black">
            {/* Base: Photorealistic AI Render */}
            <img
              src={result.imageUrl}
              alt="AI Photorealistic Sustainable Futuristic Render"
              className="absolute inset-0 h-full w-full object-contain"
            />

            {/* Clipped Top: Layer 2 Pure Sketch */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
            >
              <img
                src={result.sketchDataUrl}
                alt="Layer 2 Sketch"
                className="h-full w-full object-contain bg-black"
              />
            </div>

            {/* Divider line */}
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan-400 shadow-[0_0_12px_#00f0ff]"
              style={{ left: `${splitPct}%` }}
            >
              <div className="absolute top-1/2 -left-3.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300 bg-slate-950 font-mono-hud text-[10px] font-bold text-cyan-300">
                ↔
              </div>
            </div>

            {/* Corner Labels */}
            <span className="absolute top-3 left-3 rounded-md bg-black/70 px-2 py-1 font-mono-hud text-[10px] text-cyan-300">
              {result.includePerson ? 'SCENE INPUT (KİŞİ + ÇİZİM)' : 'LAYER 2 SKETCH'}
            </span>
            <span className="absolute top-3 right-3 rounded-md bg-black/70 px-2 py-1 font-mono-hud text-[10px] text-emerald-300">
              AI RENDER OUTPUT
            </span>
          </div>

          <div className="mx-auto mt-3 flex max-w-md items-center gap-3">
            <span className="font-mono-hud text-[10px] text-slate-400">SKETCH</span>
            <input
              type="range"
              min={0}
              max={100}
              value={splitPct}
              onChange={(e) => setSplitPct(Number(e.target.value))}
              className="hud-slider flex-1"
            />
            <span className="font-mono-hud text-[10px] text-slate-400">AI RENDER</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/70 px-5 py-3.5">
          <button
            type="button"
            onClick={() => {
              onToggleArOverlay();
              onClose();
            }}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
              arOverlayActive
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                : 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>{arOverlayActive ? 'AR Overlay Active (Hide)' : 'Project as AR Overlay on Camera'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadImage(result.sketchDataUrl, `air-sketch-${result.timestamp}.png`)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Download Sketch</span>
            </button>

            <button
              type="button"
              onClick={() => downloadImage(result.imageUrl, `air-future-render-${result.timestamp}.png`)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] hover:brightness-110"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download AI Render</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
