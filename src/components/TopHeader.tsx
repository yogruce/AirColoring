import React from 'react';
import {
  Eye,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Sparkles,
  Video,
  VideoOff,
} from 'lucide-react';
import type { CameraStatus } from '../hooks/useHandTracker';
import type { GestureState } from '../types/app';

interface TopHeaderProps {
  cameraStatus: CameraStatus;
  cameraEnabled: boolean;
  modelReady: boolean;
  handsDetected: number;
  gesture: GestureState;
  videoDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  showSketchPreview: boolean;
  isFullscreen: boolean;
  onToggleCamera: () => void;
  onSelectDevice: (deviceId: string) => void;
  onRetryCamera: () => void;
  onToggleSketchPreview: () => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  cameraStatus,
  cameraEnabled,
  modelReady,
  handsDetected,
  gesture,
  videoDevices,
  selectedDeviceId,
  showSketchPreview,
  isFullscreen,
  onToggleCamera,
  onSelectDevice,
  onRetryCamera,
  onToggleSketchPreview,
  onOpenSettings,
  onToggleFullscreen,
}) => {
  const isTrackingOn = cameraStatus === 'active' && modelReady;

  return (
    <header className="pointer-events-auto absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-4">
      {/* Left: Brand */}
      <div className="hud-glass flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-[0_0_20px_rgba(0,240,255,0.45)]">
          <Sparkles className="h-5 w-5 text-white" />
          <span className="absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full border-2 border-[#060913] bg-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-base font-bold tracking-tight text-white">
              Air Coloring Pro
            </h1>
            <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono-hud text-[10px] font-semibold text-cyan-300">
              ANTIGRAVITY
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            AI Air Coloring &amp; Sustainable Future Render Studio
          </p>
        </div>
      </div>

      {/* Center: Status Pill */}
      <div className="hud-glass hidden md:flex items-center gap-3 rounded-full px-5 py-2">
        <span className="relative flex h-2.5 w-2.5">
          {isTrackingOn ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            </>
          ) : (
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
          )}
        </span>

        <div className="flex items-center gap-2 font-mono-hud text-xs tracking-wider">
          {cameraStatus === 'active' ? (
            <Video className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <VideoOff className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span className={isTrackingOn ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
            {isTrackingOn
              ? 'CAMERA ACTIVE / GESTURE TRACKING ON'
              : cameraStatus === 'initializing'
                ? 'INITIALIZING CAMERA & MEDIAPIPE...'
                : 'MOUSE / TOUCH STUDIO MODE (NO CAMERA)'}
          </span>
        </div>

        {isTrackingOn && (
          <div className="flex items-center gap-1.5 border-l border-slate-700/80 pl-3 font-mono-hud text-[11px] text-cyan-300">
            <span className="text-slate-400">HANDS:</span>
            <span className="font-semibold text-white">{handsDetected}</span>
            <span className="ml-1 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-300">
              {gesture}
            </span>
          </div>
        )}

        {videoDevices.length > 1 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            aria-label="Kamera Seç"
            className="max-w-[140px] truncate rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-0.5 font-mono-hud text-[10px] text-slate-200 outline-none focus:border-cyan-400"
          >
            {videoDevices.map((cam, idx) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        )}

        {cameraStatus !== 'active' && cameraEnabled && (
          <button
            type="button"
            onClick={onRetryCamera}
            title="Kamerayı Yeniden Dene"
            className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono-hud text-[10px] font-semibold text-amber-200 hover:bg-amber-500/25"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry Cam</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCamera}
          title={cameraEnabled ? 'Kamerayı Kapat (Serbest Bırak)' : 'Kamerayı Aç'}
          className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono-hud text-[10px] font-semibold transition ${
            cameraEnabled
              ? 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-rose-400/50 hover:text-rose-200'
              : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
          }`}
        >
          <span>{cameraEnabled ? 'Cam Off' : 'Cam On'}</span>
        </button>
      </div>

      {/* Right: Window & Studio Controls */}
      <div className="hud-glass flex shrink-0 items-center gap-1.5 rounded-2xl p-1.5">
        <button
          type="button"
          data-air-interactive="true"
          onClick={onToggleSketchPreview}
          title="Layer 2 (Gizli Render Katmanı) Önizleme"
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition ${
            showSketchPreview
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-[0_0_14px_rgba(0,240,255,0.25)]'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Eye className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Layer 2</span>
        </button>

        <button
          type="button"
          data-air-interactive="true"
          onClick={onOpenSettings}
          title="AI Engine & Prompt Settings"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">AI Config</span>
        </button>

        <button
          type="button"
          data-air-interactive="true"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
