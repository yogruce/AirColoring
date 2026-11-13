import React from 'react';
import {
  Brush,
  Eraser,
  PaintBucket,
  Palette,
  Sparkles,
  Trash2,
  Undo2,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { RENDER_THEMES } from '../constants/prompts';
import type { DrawTriggerMode, RenderThemeId, ToolMode } from '../types/app';
import { GradientColorPicker } from './GradientColorPicker';

interface FloatingControlPanelProps {
  toolMode: ToolMode;
  brushColor: string;
  brushSize: number;
  selectedThemeId: RenderThemeId;
  drawTriggerMode: DrawTriggerMode;
  includePerson: boolean;
  canUndo: boolean;
  hasStrokes: boolean;
  isRendering: boolean;
  renderDwellProgress: number;
  renderButtonRef: React.RefObject<HTMLButtonElement | null>;
  onSelectTool: (mode: ToolMode) => void;
  onChangeColor: (hex: string) => void;
  onChangeSize: (size: number) => void;
  onSelectTheme: (themeId: RenderThemeId) => void;
  onChangeDrawTrigger: (mode: DrawTriggerMode) => void;
  onToggleIncludePerson: () => void;
  onUndo: () => void;
  onClear: () => void;
  onTriggerRender: () => void;
}

const TRIGGER_OPTIONS: Array<{ id: DrawTriggerMode; label: string; title: string }> = [
  { id: 'touch_hold', label: 'Bas-Çiz', title: 'Dokunmatik Kiosk: Sol alttaki pede basılı tutarken çizer' },
  { id: 'pinch_pen', label: 'Pinch Pen', title: 'Başparmak+İşaret birleşince çizer, açınca durur' },
  { id: 'strict_index', label: '1 Finger', title: 'Sadece işaret parmağı dik (3 kare kararlılık)' },
];

export const FloatingControlPanel: React.FC<FloatingControlPanelProps> = ({
  toolMode,
  brushColor,
  brushSize,
  selectedThemeId,
  drawTriggerMode,
  includePerson,
  canUndo,
  hasStrokes,
  isRendering,
  renderDwellProgress,
  renderButtonRef,
  onSelectTool,
  onChangeColor,
  onChangeSize,
  onSelectTheme,
  onChangeDrawTrigger,
  onToggleIncludePerson,
  onUndo,
  onClear,
  onTriggerRender,
}) => {
  return (
    <aside className="hud-glass pointer-events-auto absolute top-[74px] right-4 z-30 flex max-h-[calc(100vh-96px)] w-[274px] flex-col gap-2 overflow-y-auto rounded-2xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
        <div>
          <h2 className="font-display text-sm font-bold text-white">Air Coloring</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <span>
              {drawTriggerMode === 'touch_hold'
                ? 'Kiosk Hold-to-Draw Active'
                : drawTriggerMode === 'pinch_pen'
                  ? 'Pinch-to-Draw Active'
                  : 'Strict 1-Finger Mode'}
            </span>
          </div>
        </div>
        <div
          className="h-5 w-5 rounded-full border border-white/30"
          style={{
            backgroundColor: brushColor,
            boxShadow: `0 0 12px ${brushColor}`,
          }}
          title={`Active Color: ${brushColor}`}
        />
      </div>

      {/* Draw Trigger Mode (Fixes unintended drawing!) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-mono-hud font-semibold tracking-wider text-slate-400 uppercase">
            Draw Trigger
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {TRIGGER_OPTIONS.map((opt) => {
            const active = drawTriggerMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                data-air-interactive="true"
                onClick={() => onChangeDrawTrigger(opt.id)}
                title={opt.title}
                className={`rounded-lg border py-1 text-[10px] font-semibold transition ${
                  active
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700/70 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brush Controls */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-300">Brush Size</span>
          <span className="font-mono-hud text-cyan-300">{brushSize}px</span>
        </div>
        <input
          type="range"
          min={2}
          max={42}
          value={brushSize}
          onChange={(e) => onChangeSize(Number(e.target.value))}
          className="hud-slider w-full"
        />

        {/* Quick Tool Icons */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          <button
            type="button"
            data-air-interactive="true"
            onClick={() => onSelectTool('draw')}
            title="Brush (Çizim)"
            className={`flex h-8 items-center justify-center rounded-xl border transition ${
              toolMode === 'draw'
                ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Brush className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-air-interactive="true"
            onClick={() => onSelectTool('eraser')}
            title="Eraser (Silgi)"
            className={`flex h-8 items-center justify-center rounded-xl border transition ${
              toolMode === 'eraser'
                ? 'border-rose-400/70 bg-rose-500/20 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-air-interactive="true"
            onClick={() => onSelectTool('bucket')}
            title="Paint Bucket (Boya Kovası)"
            className={`flex h-8 items-center justify-center rounded-xl border transition ${
              toolMode === 'bucket'
                ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <PaintBucket className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-air-interactive="true"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Geri Al)"
            className="flex h-8 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/50 text-slate-300 transition hover:bg-slate-800 disabled:opacity-35"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-air-interactive="true"
            onClick={onClear}
            disabled={!hasStrokes}
            title="Clear Canvas (Temizle)"
            className="flex h-8 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/50 text-slate-300 transition hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-35"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Color Picker + 18 Quick Swatches */}
      <GradientColorPicker
        color={brushColor}
        onChange={(hex) => {
          onChangeColor(hex);
          if (toolMode === 'eraser' || toolMode === 'color') {
            onSelectTool('draw');
          }
        }}
      />

      {/* Mode Buttons */}
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          data-air-interactive="true"
          onClick={() => onSelectTool('draw')}
          className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition ${
            toolMode === 'draw'
              ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
              : 'border-slate-700/70 bg-slate-900/50 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brush className="h-3 w-3" />
          <span>Drawing</span>
        </button>

        <button
          type="button"
          data-air-interactive="true"
          onClick={() => onSelectTool('color')}
          className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition ${
            toolMode === 'color'
              ? 'border-fuchsia-400/70 bg-fuchsia-500/20 text-fuchsia-200'
              : 'border-slate-700/70 bg-slate-900/50 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="h-3 w-3" />
          <span>Color</span>
        </button>

        <button
          type="button"
          data-air-interactive="true"
          onClick={() => onSelectTool('eraser')}
          className={`flex items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-semibold transition ${
            toolMode === 'eraser'
              ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
              : 'border-slate-700/70 bg-slate-900/50 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eraser className="h-3 w-3" />
          <span>Eraser</span>
        </button>
      </div>

      {/* Render Theme Quick Selector */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-mono-hud font-semibold tracking-wider text-slate-400 uppercase">
            Render Theme
          </span>
          <span className="font-mono-hud text-cyan-300">
            {RENDER_THEMES.find((t) => t.id === selectedThemeId)?.shortLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {RENDER_THEMES.map((theme) => {
            const active = selectedThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                data-air-interactive="true"
                onClick={() => onSelectTheme(theme.id)}
                title={theme.description}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                  active
                    ? 'border-cyan-400/70 bg-cyan-500/15 text-white'
                    : 'border-slate-700/70 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: theme.accentHex,
                    boxShadow: active ? `0 0 8px ${theme.accentHex}` : undefined,
                  }}
                />
                <span className="truncate">{theme.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scene Include Person Toggle */}
      <button
        type="button"
        data-air-interactive="true"
        onClick={onToggleIncludePerson}
        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${
          includePerson
            ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
            : 'border-slate-700/70 bg-slate-900/60 text-slate-400'
        }`}
        title="Render sırasında kameradaki kişinin de sahneye dahil edilip edilmeyeceği"
      >
        <span className="flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Sahne: {includePerson ? 'Kişi + Çizim' : 'Sadece Çizim'}</span>
        </span>
        <span className="font-mono-hud text-[9px] uppercase">
          {includePerson ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* AI Render / Transform Button */}
      <button
        ref={renderButtonRef}
        type="button"
        data-air-interactive="true"
        disabled={isRendering || !hasStrokes}
        onClick={onTriggerRender}
        className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500 px-4 py-2.5 text-xs font-bold tracking-wide text-white shadow-[0_0_24px_rgba(0,240,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {renderDwellProgress > 0 && (
          <span
            className="absolute inset-y-0 left-0 bg-white/30 transition-all duration-75"
            style={{ width: `${Math.round(renderDwellProgress * 100)}%` }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isRendering ? (
            <>
              <Sparkles className="h-4 w-4 animate-spin" />
              <span>AI RENDERING...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              <span>AI RENDER / TRANSFORM</span>
            </>
          )}
        </span>
      </button>
    </aside>
  );
};
