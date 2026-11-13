import React from 'react';
import { Fingerprint } from 'lucide-react';

interface TouchDrawPadProps {
  active: boolean;
  onHoldChange: (pressed: boolean) => void;
}

export const TouchDrawPad: React.FC<TouchDrawPadProps> = ({ active, onHoldChange }) => {
  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture unavailable
    }
    onHoldChange(true);
  };

  const handleRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onHoldChange(false);
  };

  return (
    <button
      type="button"
      onPointerDown={handleDown}
      onPointerUp={handleRelease}
      onPointerCancel={handleRelease}
      onLostPointerCapture={() => onHoldChange(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto absolute bottom-5 left-5 z-30 flex touch-none select-none items-center gap-3.5 rounded-2xl border px-5 py-4 transition-all duration-150 ${
        active
          ? 'scale-[0.98] border-emerald-400 bg-emerald-500/30 text-white shadow-[0_0_32px_rgba(16,185,129,0.55)]'
          : 'hud-glass border-cyan-400/35 text-slate-100 hover:border-cyan-400/70'
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl border transition ${
          active
            ? 'border-emerald-300 bg-emerald-400/25 text-emerald-200'
            : 'border-cyan-400/30 bg-cyan-500/15 text-cyan-300'
        }`}
      >
        <Fingerprint className={`h-7 w-7 ${active ? 'animate-pulse' : ''}`} />
      </div>

      <div className="text-left">
        <div className="font-display text-sm font-bold tracking-wide">
          {active ? 'ÇİZİM AKTİF — ELİNİZİ OYNATIN' : 'BASILI TUT — HAVADA ÇİZ'}
        </div>
        <div className="font-mono-hud text-[10px] text-slate-300">
          {active ? 'Bıraktığınız anda çizim durur' : 'Diğer elinizle havada çizim yapın'}
        </div>
      </div>
    </button>
  );
};
