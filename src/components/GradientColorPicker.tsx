import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QUICK_COLOR_SWATCHES } from '../constants/colors';

interface GradientColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`.toUpperCase();
}

export const GradientColorPicker: React.FC<GradientColorPickerProps> = ({ color, onChange }) => {
  const [hue, setHue] = useState(185);
  const [sat, setSat] = useState(1);
  const [val, setVal] = useState(1);
  const svBoxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const pickFromBox = useCallback(
    (clientX: number, clientY: number) => {
      const box = svBoxRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      setSat(s);
      setVal(v);
      onChange(hsvToHex(hue, s, v));
    },
    [hue, onChange]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) pickFromBox(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pickFromBox]);

  const handleHueChange = (newHue: number) => {
    setHue(newHue);
    onChange(hsvToHex(newHue, sat, val));
  };

  return (
    <div className="space-y-2">
      {/* 2D Saturation / Brightness Gradient Field */}
      <div
        ref={svBoxRef}
        data-air-interactive="true"
        onPointerDown={(e) => {
          draggingRef.current = true;
          pickFromBox(e.clientX, e.clientY);
        }}
        className="relative h-16 w-full cursor-crosshair overflow-hidden rounded-xl border border-slate-700/80"
        style={{
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.85)]"
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Hue Bar */}
      <input
        type="range"
        min={0}
        max={359}
        value={hue}
        onChange={(e) => handleHueChange(Number(e.target.value))}
        aria-label="Hue"
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full border border-slate-700/70 outline-none"
        style={{
          background:
            'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
        }}
      />

      {/* 18 Quick Color Swatches */}
      <div className="grid grid-cols-6 gap-1.5 pt-0.5">
        {QUICK_COLOR_SWATCHES.map((swatch) => {
          const active = color.toUpperCase() === swatch.toUpperCase();
          return (
            <button
              key={swatch}
              type="button"
              data-air-interactive="true"
              onClick={() => onChange(swatch)}
              title={swatch}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                active
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#091124] scale-110'
                  : 'border border-white/20'
              }`}
              style={{
                backgroundColor: swatch,
                boxShadow: active ? `0 0 12px ${swatch}` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
