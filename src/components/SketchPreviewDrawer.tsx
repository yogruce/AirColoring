import React, { useEffect, useState } from 'react';
import { Download, Layers, X } from 'lucide-react';

interface SketchPreviewDrawerProps {
  open: boolean;
  invertToWhiteBg: boolean;
  includePerson: boolean;
  hasStrokes: boolean;
  exportSketchBase64: (invertToWhiteBg: boolean) => string;
  exportCompositeBase64: () => string;
  onClose: () => void;
}

export const SketchPreviewDrawer: React.FC<SketchPreviewDrawerProps> = ({
  open,
  invertToWhiteBg,
  includePerson,
  hasStrokes,
  exportSketchBase64,
  exportCompositeBase64,
  onClose,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showComposite, setShowComposite] = useState(includePerson);
  const [showInverted, setShowInverted] = useState(invertToWhiteBg);

  useEffect(() => {
    setShowComposite(includePerson);
  }, [includePerson]);

  useEffect(() => {
    setShowInverted(invertToWhiteBg);
  }, [invertToWhiteBg]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const url = showComposite ? exportCompositeBase64() : exportSketchBase64(showInverted);
      if (url) setPreviewUrl(url);
    };
    update();
    const id = window.setInterval(update, 400);
    return () => window.clearInterval(id);
  }, [open, showComposite, showInverted, exportSketchBase64, exportCompositeBase64]);

  if (!open) return null;

  const handleDownload = () => {
    const url = showComposite ? exportCompositeBase64() : exportSketchBase64(showInverted);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `air-coloring-${showComposite ? 'scene' : 'layer2'}-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="hud-glass pointer-events-auto absolute top-20 left-4 z-30 w-[308px] rounded-2xl p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <div>
            <h3 className="font-display text-xs font-bold text-white">
              {showComposite ? 'Scene Input: Kişi + Çizim' : 'Layer 2: Pure Sketch Canvas'}
            </h3>
            <p className="text-[10px] text-slate-400">
              {showComposite
                ? 'Camera frame + neon strokes sent to AI'
                : 'Isolated strokes only (no camera / HUD)'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-black">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="AI Input Preview"
            className="aspect-video w-full object-contain"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-xs text-slate-500">
            Draw something in the air to inspect input
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => setShowComposite((v) => !v)}
          className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[10px] font-medium text-slate-200 hover:border-cyan-400/50"
        >
          {showComposite ? 'View: Kişi+Çizim' : 'View: Saf Sketch'}
        </button>

        {!showComposite && (
          <button
            type="button"
            onClick={() => setShowInverted((v) => !v)}
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[10px] font-medium text-slate-200 hover:border-cyan-400/50"
          >
            {showInverted ? 'White BG' : 'Black BG'}
          </button>
        )}

        <button
          type="button"
          disabled={!hasStrokes && !showComposite}
          onClick={handleDownload}
          className="flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/30 disabled:opacity-40"
        >
          <Download className="h-3 w-3" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};
