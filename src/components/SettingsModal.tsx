import React, { useState } from 'react';
import { RotateCcw, Sliders, X } from 'lucide-react';
import { RENDER_THEMES, getRenderTheme } from '../constants/prompts';
import type {
  AiProvider,
  ControlNetPreprocessor,
  DrawTriggerMode,
  RenderConfig,
  RenderThemeId,
} from '../types/app';

interface SettingsModalProps {
  open: boolean;
  config: RenderConfig;
  serverStatus: {
    gemini: boolean;
    fal: boolean;
    replicate: boolean;
    comfyui: string;
  };
  onSave: (next: RenderConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  config,
  serverStatus,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<RenderConfig>(config);

  React.useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  if (!open) return null;

  const providers: Array<{ id: AiProvider; label: string; desc: string }> = [
    {
      id: 'gemini',
      label: 'Google Gemini API (Önerilen)',
      desc: 'gemini-2.5-flash-image (Kişi + Çizim multimodal render)',
    },
    { id: 'fal', label: 'Fal.ai (ControlNet / Flux)', desc: 'Alternatif bulut SDXL/Flux API' },
    { id: 'replicate', label: 'Replicate API', desc: 'Alternatif SDXL img2img / Scribble' },
    { id: 'comfyui', label: 'Local ComfyUI', desc: 'Yerel ComfyUI sunucusu' },
    { id: 'demo', label: 'Demo Simulation', desc: 'API anahtarsız çevrimdışı önizleme' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="hud-glass flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white">
                AI Render Engine &amp; ControlNet Pipeline
              </h2>
              <p className="text-xs text-slate-400">
                Configure ControlNet Scribble parameters, prompts, and inference provider
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

        {/* Body */}
        <div className="space-y-5 overflow-y-auto p-5">
          {/* Render Theme Preset Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
              Render Theme Preset
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {RENDER_THEMES.map((theme) => {
                const active = draft.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        themeId: theme.id as RenderThemeId,
                        prompt: theme.prompt,
                        negativePrompt: theme.negativePrompt,
                        controlWeight: theme.recommendedControlWeight,
                        denoisingStrength: theme.recommendedDenoising,
                      })
                    }
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-slate-700/70 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: theme.accentHex }}
                      />
                      <span>{theme.label}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{theme.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
              Inference Provider
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, provider: p.id })}
                  className={`rounded-xl border p-3 text-left transition ${
                    draft.provider === p.id
                      ? 'border-cyan-400 bg-cyan-500/15 text-white'
                      : 'border-slate-700/70 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{p.label}</span>
                    {p.id === 'gemini' && serverStatus.gemini && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                        .env OK
                      </span>
                    )}
                    {p.id === 'fal' && serverStatus.fal && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                        .env OK
                      </span>
                    )}
                    {p.id === 'replicate' && serverStatus.replicate && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                        .env OK
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Credentials */}
          {(draft.provider === 'gemini' ||
            draft.provider === 'fal' ||
            draft.provider === 'replicate') && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {draft.provider === 'gemini'
                  ? 'Google Gemini API Key (GEMINI_API_KEY)'
                  : draft.provider === 'fal'
                    ? 'Fal.ai API Key (FAL_KEY)'
                    : 'Replicate API Token'}
              </label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder={
                  (draft.provider === 'gemini' && serverStatus.gemini) ||
                  (draft.provider === 'fal' && serverStatus.fal) ||
                  (draft.provider === 'replicate' && serverStatus.replicate)
                    ? 'Sunucu .env içindeki anahtar kullanılıyor (isteğe bağlı değiştirin)'
                    : draft.provider === 'gemini'
                      ? 'Google AI Studio API Key (AIza...) yapıştırın veya .env dosyasına ekleyin'
                      : 'API anahtarını yapıştırın veya .env dosyasına ekleyin'
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 font-mono-hud text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {draft.provider === 'comfyui' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">ComfyUI Server URL</label>
              <input
                type="text"
                value={draft.comfyUrl}
                onChange={(e) => setDraft({ ...draft, comfyUrl: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 font-mono-hud text-xs text-white outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {/* Air Drawing Precision & Scene Source */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
                Air Drawing Precision &amp; Scene Source
              </label>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, includePerson: !draft.includePerson })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                  draft.includePerson
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                {draft.includePerson
                  ? 'Sahne: Kişi + Çizim (Kamera Dahil)'
                  : 'Sahne: Sadece Çizim (İzole Sketch)'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Draw Trigger</label>
                <select
                  value={draft.drawTriggerMode}
                  onChange={(e) =>
                    setDraft({ ...draft, drawTriggerMode: e.target.value as DrawTriggerMode })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                >
                  <option value="touch_hold">Bas-Çiz (Dokunmatik Kiosk Pedi)</option>
                  <option value="pinch_pen">Pinch Pen (Birleştir = Çiz)</option>
                  <option value="strict_index">Strict 1-Finger (3 Kare)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-300">Jitter Deadzone</span>
                  <span className="font-mono-hud text-cyan-300">
                    {draft.minMoveThreshold.toFixed(1)}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={draft.minMoveThreshold}
                  onChange={(e) =>
                    setDraft({ ...draft, minMoveThreshold: Number(e.target.value) })
                  }
                  className="hud-slider w-full"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-300">EMA Smoothing</span>
                  <span className="font-mono-hud text-cyan-300">
                    {draft.smoothingAlpha.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.85}
                  step={0.05}
                  value={draft.smoothingAlpha}
                  onChange={(e) =>
                    setDraft({ ...draft, smoothingAlpha: Number(e.target.value) })
                  }
                  className="hud-slider w-full"
                />
              </div>
            </div>
          </div>

          {/* ControlNet Sliders */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Preprocessor</label>
              <select
                value={draft.preprocessor}
                onChange={(e) =>
                  setDraft({ ...draft, preprocessor: e.target.value as ControlNetPreprocessor })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
              >
                <option value="invert">invert (Black → White Scribble)</option>
                <option value="scribble_hed">scribble_hed (Direct Neon)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Control Weight</span>
                <span className="font-mono-hud text-cyan-300">{draft.controlWeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={1.0}
                step={0.05}
                value={draft.controlWeight}
                onChange={(e) => setDraft({ ...draft, controlWeight: Number(e.target.value) })}
                className="hud-slider w-full"
              />
              <p className="text-[10px] text-slate-400">Recommended: 0.75 – 0.85</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Denoising Strength</span>
                <span className="font-mono-hud text-cyan-300">
                  {draft.denoisingStrength.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.0}
                step={0.05}
                value={draft.denoisingStrength}
                onChange={(e) =>
                  setDraft({ ...draft, denoisingStrength: Number(e.target.value) })
                }
                className="hud-slider w-full"
              />
              <p className="text-[10px] text-slate-400">Recommended: 0.80</p>
            </div>
          </div>

          {/* Master Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Master Prompt (Sustainable Futuristic Vision)
              </label>
              <button
                type="button"
                onClick={() => {
                  const preset = getRenderTheme(draft.themeId);
                  setDraft({
                    ...draft,
                    prompt: preset.prompt,
                    negativePrompt: preset.negativePrompt,
                    controlWeight: preset.recommendedControlWeight,
                    denoisingStrength: preset.recommendedDenoising,
                  });
                }}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Theme Prompt</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={draft.prompt}
              onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-cyan-400"
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Negative Prompt</label>
            <textarea
              rows={2}
              value={draft.negativePrompt}
              onChange={(e) => setDraft({ ...draft, negativePrompt: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-700/70 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(0,240,255,0.3)] hover:brightness-110"
          >
            Save Pipeline Config
          </button>
        </div>
      </div>
    </div>
  );
};
