import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, EyeOff, Sparkles } from 'lucide-react';
import { DEFAULT_BRUSH_COLOR, DEFAULT_BRUSH_SIZE } from './constants/colors';
import { DEFAULT_RENDER_CONFIG, buildEffectivePrompts, getRenderTheme } from './constants/prompts';
import { FloatingControlPanel } from './components/FloatingControlPanel';
import { RenderResultModal } from './components/RenderResultModal';
import { SettingsModal } from './components/SettingsModal';
import { SketchPreviewDrawer } from './components/SketchPreviewDrawer';
import { TopHeader } from './components/TopHeader';
import { TouchDrawPad } from './components/TouchDrawPad';
import { useDualCanvas } from './hooks/useDualCanvas';
import { useHandTracker } from './hooks/useHandTracker';
import type {
  DrawTriggerMode,
  HandTelemetry,
  Point,
  RenderConfig,
  RenderResult,
  RenderThemeId,
  ToolMode,
} from './types/app';
import { generateDemoSustainableRender } from './utils/renderDemo';

const INITIAL_TELEMETRY: HandTelemetry = {
  fps: 60,
  latencyMs: 0,
  velocity: 0,
  overallConfidence: 0,
  fingerConfidences: {
    wrist: 0,
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0,
  },
  handsDetected: 0,
  gesture: 'IDLE',
  cursor: null,
  pinching: false,
  frameProgress: 0,
};

const CONFIG_STORAGE_KEY = 'aircoloring_render_config_v1';
const API_KEY_SESSION_KEY = 'aircoloring_session_apikey';

function loadInitialRenderConfig(): RenderConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    const sessionKey = sessionStorage.getItem(API_KEY_SESSION_KEY) || '';
    if (!raw) return { ...DEFAULT_RENDER_CONFIG, apiKey: sessionKey };
    const parsed = JSON.parse(raw) as Partial<RenderConfig>;
    return {
      ...DEFAULT_RENDER_CONFIG,
      ...parsed,
      apiKey: sessionKey,
    };
  } catch {
    return DEFAULT_RENDER_CONFIG;
  }
}

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderButtonRef = useRef<HTMLButtonElement | null>(null);

  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [toolMode, setToolMode] = useState<ToolMode>('draw');
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [telemetry, setTelemetry] = useState<HandTelemetry>(INITIAL_TELEMETRY);

  const [showSketchPreview, setShowSketchPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(() => {
    return sessionStorage.getItem('aircoloring_cam_off') !== '1';
  });

  const handleToggleCamera = useCallback(() => {
    setCameraEnabled((prev) => {
      const next = !prev;
      if (next) sessionStorage.removeItem('aircoloring_cam_off');
      else sessionStorage.setItem('aircoloring_cam_off', '1');
      return next;
    });
  }, []);
  const [touchHoldActive, setTouchHoldActive] = useState(false);
  const touchHoldActiveRef = useRef(false);

  const handleTouchHoldChange = useCallback((pressed: boolean) => {
    touchHoldActiveRef.current = pressed;
    setTouchHoldActive(pressed);
  }, []);

  const [renderConfig, setRenderConfig] = useState<RenderConfig>(loadInitialRenderConfig);

  useEffect(() => {
    try {
      const { apiKey, ...persisted } = renderConfig;
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(persisted));
      if (apiKey) sessionStorage.setItem(API_KEY_SESSION_KEY, apiKey);
      else sessionStorage.removeItem(API_KEY_SESSION_KEY);
    } catch {
      // Storage may be unavailable in restricted contexts
    }
  }, [renderConfig]);

  useEffect(() => {
    const onBlur = () => {
      touchHoldActiveRef.current = false;
      setTouchHoldActive(false);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);
  const [serverStatus, setServerStatus] = useState({
    gemini: false,
    fal: false,
    replicate: false,
    comfyui: 'http://127.0.0.1:8188',
  });

  const [isRendering, setIsRendering] = useState(false);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [arOverlayActive, setArOverlayActive] = useState(false);
  const [bannerError, setBannerError] = useState<{
    message: string;
    canFallbackDemo: boolean;
  } | null>(null);

  // Finger dwell state for 2-second AI Render button hover trigger
  const [renderDwellProgress, setRenderDwellProgress] = useState(0);
  const dwellStartRef = useRef<number>(0);
  const dwellTriggeredRef = useRef<boolean>(false);
  const isPointerDrawingRef = useRef<boolean>(false);

  const {
    visualCanvasRef,
    canUndo,
    hasStrokes,
    beginStroke,
    moveStroke,
    endStroke,
    eraseArea,
    fillAt,
    undo,
    clearAll,
    exportSketchBase64,
    exportCompositeBase64,
  } = useDualCanvas(viewport.width, viewport.height);

  // Measure viewport
  useEffect(() => {
    const updateSize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Probe backend health
  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.configured) {
          setServerStatus(data.configured);
        }
      })
      .catch(() => {
        // Backend might still be starting or offline
      });
  }, []);

  const handleSelectTheme = useCallback((themeId: RenderThemeId) => {
    const preset = getRenderTheme(themeId);
    setRenderConfig((prev) => ({
      ...prev,
      themeId: preset.id,
      prompt: preset.prompt,
      negativePrompt: preset.negativePrompt,
      controlWeight: preset.recommendedControlWeight,
      denoisingStrength: prev.includePerson ? Math.min(0.75, preset.recommendedDenoising) : preset.recommendedDenoising,
    }));
  }, []);

  const handleChangeDrawTrigger = useCallback((mode: DrawTriggerMode) => {
    setRenderConfig((prev) => ({ ...prev, drawTriggerMode: mode }));
  }, []);

  const handleToggleIncludePerson = useCallback(() => {
    setRenderConfig((prev) => ({ ...prev, includePerson: !prev.includePerson }));
  }, []);

  const executeRender = useCallback(
    async (forceDemo = false) => {
      if (isRendering || !hasStrokes) return;
      setBannerError(null);
      setIsRendering(true);

      const started = performance.now();
      const useInvert = renderConfig.preprocessor === 'invert';
      const sketchOnlyUrl = exportSketchBase64(false);
      const inputImageUrl = renderConfig.includePerson
        ? exportCompositeBase64(videoRef.current)
        : exportSketchBase64(useInvert);

      const effective = buildEffectivePrompts(
        renderConfig.prompt,
        renderConfig.negativePrompt,
        renderConfig.includePerson
      );

      try {
        if (forceDemo || renderConfig.provider === 'demo') {
          const demoUrl = await generateDemoSustainableRender(
            sketchOnlyUrl,
            renderConfig.themeId,
            renderConfig.includePerson ? inputImageUrl : undefined
          );
          setRenderResult({
            imageUrl: demoUrl,
            sketchDataUrl: inputImageUrl,
            provider: 'demo',
            themeId: renderConfig.themeId,
            includePerson: renderConfig.includePerson,
            prompt: effective.prompt,
            controlWeight: renderConfig.controlWeight,
            denoisingStrength: renderConfig.denoisingStrength,
            durationMs: Math.round(performance.now() - started),
            isDemo: true,
            timestamp: Date.now(),
          });
          return;
        }

        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sketchBase64: inputImageUrl,
            sketchOnlyBase64: renderConfig.includePerson ? sketchOnlyUrl : undefined,
            provider: renderConfig.provider,
            includePerson: renderConfig.includePerson,
            apiKey: renderConfig.apiKey,
            comfyUrl: renderConfig.comfyUrl,
            prompt: effective.prompt,
            negativePrompt: effective.negativePrompt,
            preprocessor: renderConfig.preprocessor,
            controlWeight: renderConfig.controlWeight,
            denoisingStrength: renderConfig.denoisingStrength,
          }),
        });

        const payload = (await res.json()) as {
          imageUrl?: string;
          durationMs?: number;
          error?: string;
          message?: string;
        };

        if (!res.ok || !payload.imageUrl) {
          setBannerError({
            message: payload.message || 'AI render request failed.',
            canFallbackDemo: true,
          });
          return;
        }

        setRenderResult({
          imageUrl: payload.imageUrl,
          sketchDataUrl: inputImageUrl,
          provider: renderConfig.provider,
          themeId: renderConfig.themeId,
          includePerson: renderConfig.includePerson,
          prompt: effective.prompt,
          controlWeight: renderConfig.controlWeight,
          denoisingStrength: renderConfig.denoisingStrength,
          durationMs: payload.durationMs ?? Math.round(performance.now() - started),
          isDemo: false,
          timestamp: Date.now(),
        });
      } catch (err) {
        setBannerError({
          message: err instanceof Error ? err.message : 'Network error connecting to render backend.',
          canFallbackDemo: true,
        });
      } finally {
        setIsRendering(false);
      }
    },
    [exportCompositeBase64, exportSketchBase64, hasStrokes, isRendering, renderConfig]
  );

  // Hand tracker gesture callbacks
  const handleDrawPoint = useCallback(
    (pt: Point, isStart: boolean) => {
      if (toolMode === 'eraser') {
        eraseArea(pt, Math.max(20, brushSize * 2));
        return;
      }
      if (toolMode === 'bucket') {
        if (isStart) fillAt(pt, brushColor);
        return;
      }
      if (isStart) {
        beginStroke(pt, brushColor, brushSize, false);
      } else {
        moveStroke(pt, brushColor, brushSize, false);
      }
    },
    [beginStroke, brushColor, brushSize, eraseArea, fillAt, moveStroke, toolMode]
  );

  const handleErasePoint = useCallback(
    (pt: Point) => {
      eraseArea(pt, Math.max(28, brushSize * 2.6));
    },
    [brushSize, eraseArea]
  );

  const handleHoverCursor = useCallback(
    (pt: Point | null, pinchClick: boolean) => {
      if (!pt) {
        dwellStartRef.current = 0;
        dwellTriggeredRef.current = false;
        setRenderDwellProgress(0);
        return;
      }

      // Check 2-second dwell over AI Render button
      const btn = renderButtonRef.current;
      if (btn && hasStrokes && !isRendering) {
        const rect = btn.getBoundingClientRect();
        const insideRenderBtn =
          pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom;

        if (insideRenderBtn) {
          const now = performance.now();
          if (dwellStartRef.current === 0) dwellStartRef.current = now;
          const progress = Math.min(1, (now - dwellStartRef.current) / 2000);
          setRenderDwellProgress(progress);
          if (progress >= 1 && !dwellTriggeredRef.current) {
            dwellTriggeredRef.current = true;
            executeRender(false);
          }
        } else {
          dwellStartRef.current = 0;
          dwellTriggeredRef.current = false;
          setRenderDwellProgress(0);
        }
      }

      // Pinch-to-click any interactive UI button/swatch underneath the air cursor
      if (pinchClick) {
        const el = document.elementFromPoint(pt.x, pt.y) as HTMLElement | null;
        const interactive = el?.closest('[data-air-interactive="true"]') as HTMLElement | null;
        if (interactive) {
          interactive.click();
        }
      }
    },
    [executeRender, hasStrokes, isRendering]
  );

  const {
    cameraStatus,
    cameraError,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    retryCamera,
    modelReady,
    modelError,
  } = useHandTracker({
    videoRef,
    hudCanvasRef,
    touchHoldActiveRef,
    enabled: cameraEnabled,
    brushColor,
    brushSize,
    drawTriggerMode: renderConfig.drawTriggerMode,
    minMoveThreshold: renderConfig.minMoveThreshold,
    smoothingAlpha: renderConfig.smoothingAlpha,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    onTelemetry: setTelemetry,
    onDrawPoint: handleDrawPoint,
    onDrawEnd: endStroke,
    onErasePoint: handleErasePoint,
    onHoverCursor: handleHoverCursor,
    onTwoHandRenderTrigger: () => executeRender(false),
  });

  // Mouse / Touch fallback drawing directly on Layer 1
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pt = getCanvasPoint(e);
    if (toolMode === 'bucket') {
      fillAt(pt, brushColor);
      return;
    }
    isPointerDrawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    beginStroke(pt, brushColor, brushSize, toolMode === 'eraser');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDrawingRef.current) return;
    const pt = getCanvasPoint(e);
    moveStroke(pt, brushColor, brushSize, toolMode === 'eraser');
  };

  const handlePointerUp = () => {
    if (!isPointerDrawingRef.current) return;
    isPointerDrawingRef.current = false;
    endStroke();
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-[#060913] select-none"
    >
      {/* Background: Mirrored Webcam Feed OR Sleek Studio Grid Fallback */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-500 ${
          cameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {cameraStatus !== 'active' && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 45%, rgba(14, 116, 144, 0.22), rgba(6, 9, 19, 0.96) 72%), linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        />
      )}

      {/* Subtle dark vignette for crisp neon HUD contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/55" />

      {/* Optional AR Overlay Projection */}
      {arOverlayActive && renderResult && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <img
            src={renderResult.imageUrl}
            alt="AR Projected Render"
            className="h-full w-full object-cover opacity-90"
          />
          <button
            type="button"
            onClick={() => setArOverlayActive(false)}
            className="hud-glass pointer-events-auto absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-300"
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>Hide AR Projection</span>
          </button>
        </div>
      )}

      {/* LAYER 1: Neon Air Coloring Visual Canvas */}
      <canvas
        ref={visualCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
      />

      {/* HUD OVERLAY: 21-Landmark Blue Skeleton & Air Cursor */}
      <canvas
        ref={hudCanvasRef}
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      />

      {/* Top Header */}
      <TopHeader
        cameraStatus={cameraStatus}
        cameraEnabled={cameraEnabled}
        modelReady={modelReady}
        handsDetected={telemetry.handsDetected}
        gesture={telemetry.gesture}
        videoDevices={videoDevices}
        selectedDeviceId={selectedDeviceId}
        showSketchPreview={showSketchPreview}
        isFullscreen={isFullscreen}
        onToggleCamera={handleToggleCamera}
        onSelectDevice={setSelectedDeviceId}
        onRetryCamera={retryCamera}
        onToggleSketchPreview={() => setShowSketchPreview((v) => !v)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Right Floating Control Panel */}
      <FloatingControlPanel
        toolMode={toolMode}
        brushColor={brushColor}
        brushSize={brushSize}
        selectedThemeId={renderConfig.themeId}
        drawTriggerMode={renderConfig.drawTriggerMode}
        includePerson={renderConfig.includePerson}
        canUndo={canUndo}
        hasStrokes={hasStrokes}
        isRendering={isRendering}
        renderDwellProgress={renderDwellProgress}
        renderButtonRef={renderButtonRef}
        onSelectTool={setToolMode}
        onChangeColor={setBrushColor}
        onChangeSize={setBrushSize}
        onSelectTheme={handleSelectTheme}
        onChangeDrawTrigger={handleChangeDrawTrigger}
        onToggleIncludePerson={handleToggleIncludePerson}
        onUndo={undo}
        onClear={clearAll}
        onTriggerRender={() => executeRender(false)}
      />

      {/* Left Optional Layer 2 / Scene Inspector */}
      <SketchPreviewDrawer
        open={showSketchPreview}
        invertToWhiteBg={renderConfig.preprocessor === 'invert'}
        includePerson={renderConfig.includePerson}
        hasStrokes={hasStrokes}
        exportSketchBase64={exportSketchBase64}
        exportCompositeBase64={() => exportCompositeBase64(videoRef.current)}
        onClose={() => setShowSketchPreview(false)}
      />

      {/* Kiosk Touch-Hold Draw Pad (visible when Bas-Çiz mode is active) */}
      {renderConfig.drawTriggerMode === 'touch_hold' && (
        <TouchDrawPad active={touchHoldActive} onHoldChange={handleTouchHoldChange} />
      )}

      {/* Bottom-Center Gesture Quick Reference Pill */}
      <div className="hud-glass pointer-events-none absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 rounded-full px-5 py-2 text-[11px] text-slate-300 xl:flex">
        {renderConfig.drawTriggerMode === 'pinch_pen' ? (
          <>
            <span>
              <strong className="text-emerald-300">Pinch (Thumb+Index):</strong> Draw
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-cyan-300">Open Fingers:</strong> Hover (No Draw)
            </span>
          </>
        ) : renderConfig.drawTriggerMode === 'touch_hold' ? (
          <>
            <span>
              <strong className="text-emerald-300">Touch Pad / Space:</strong> Draw
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-cyan-300">Release:</strong> Hover (No Draw)
            </span>
          </>
        ) : (
          <>
            <span>
              <strong className="text-cyan-300">1 Strict Finger:</strong> Draw
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-cyan-300">2 Fingers:</strong> Hover UI
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <strong className="text-amber-300">Pinch:</strong> Pause / Click
            </span>
          </>
        )}
        <span className="text-slate-600">|</span>
        <span>
          <strong className="text-rose-300">5 Fingers:</strong> Erase
        </span>
        <span className="text-slate-600">|</span>
        <span>
          <strong className="text-emerald-300">2-Hand Frame:</strong> AI Render
        </span>
      </div>

      {/* Model / Camera / API Error Banner */}
      {(bannerError || modelError || cameraError) && (
        <div className="hud-glass pointer-events-auto absolute top-20 left-1/2 z-40 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl border-amber-400/40 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-xs text-slate-200">
            {bannerError?.message || cameraError || modelError}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {cameraError && !bannerError && (
              <button
                type="button"
                onClick={retryCamera}
                className="rounded-lg border border-amber-400/40 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30"
              >
                Kamerayı Yeniden Dene
              </button>
            )}
            {bannerError?.canFallbackDemo && (
              <button
                type="button"
                onClick={() => executeRender(true)}
                className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 border border-emerald-400/40 hover:bg-emerald-500/30"
              >
                <Sparkles className="h-3 w-3" />
                <span>Run Demo Preview</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-lg bg-cyan-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/30"
            >
              AI Config
            </button>
            {bannerError && (
              <button
                type="button"
                onClick={() => setBannerError(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        open={showSettings}
        config={renderConfig}
        serverStatus={serverStatus}
        onSave={setRenderConfig}
        onClose={() => setShowSettings(false)}
      />

      <RenderResultModal
        result={renderResult}
        arOverlayActive={arOverlayActive}
        onToggleArOverlay={() => setArOverlayActive((v) => !v)}
        onClose={() => setRenderResult(null)}
      />
    </div>
  );
}

export default App;
