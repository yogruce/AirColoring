import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '../types/app';
import { floodFillCanvas } from '../utils/floodFill';

interface CanvasSnapshot {
  visual: ImageData;
  sketch: ImageData;
  hasStrokes: boolean;
}

const MAX_HISTORY = 25;

export function useDualCanvas(width: number, height: number) {
  const visualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const midPointRef = useRef<Point | null>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<CanvasSnapshot[]>([]);
  const hasStrokesRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const updateHasStrokes = useCallback((value: boolean) => {
    hasStrokesRef.current = value;
    setHasStrokes(value);
  }, []);

  const getContexts = useCallback(() => {
    const visual = visualCanvasRef.current;
    const sketch = sketchCanvasRef.current;
    if (!visual || !sketch || visual.width === 0 || visual.height === 0) return null;
    const vCtx = visual.getContext('2d', { willReadFrequently: true });
    const sCtx = sketch.getContext('2d', { willReadFrequently: true });
    if (!vCtx || !sCtx) return null;
    return { visual, sketch, vCtx, sCtx };
  }, []);

  const ensureSketchBlackBg = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }, []);

  // Initialize or resize both canvases while preserving artwork
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    const visual = visualCanvasRef.current;
    if (!visual) return;

    if (!sketchCanvasRef.current) {
      sketchCanvasRef.current = document.createElement('canvas');
    }
    const sketch = sketchCanvasRef.current;

    if (visual.width === width && visual.height === height && sketch.width === width && sketch.height === height) {
      return;
    }

    // Preserve previous artwork if resizing
    let prevVisual: HTMLCanvasElement | null = null;
    let prevSketch: HTMLCanvasElement | null = null;

    if (visual.width > 0 && visual.height > 0 && hasStrokes) {
      prevVisual = document.createElement('canvas');
      prevVisual.width = visual.width;
      prevVisual.height = visual.height;
      prevVisual.getContext('2d')?.drawImage(visual, 0, 0);

      prevSketch = document.createElement('canvas');
      prevSketch.width = sketch.width;
      prevSketch.height = sketch.height;
      prevSketch.getContext('2d')?.drawImage(sketch, 0, 0);
    }

    visual.width = width;
    visual.height = height;
    sketch.width = width;
    sketch.height = height;

    const vCtx = visual.getContext('2d', { willReadFrequently: true });
    const sCtx = sketch.getContext('2d', { willReadFrequently: true });
    if (sCtx) ensureSketchBlackBg(sCtx, width, height);

    if (prevVisual && vCtx) {
      vCtx.drawImage(prevVisual, 0, 0, width, height);
    }
    if (prevSketch && sCtx) {
      sCtx.drawImage(prevSketch, 0, 0, width, height);
    }
  }, [width, height, ensureSketchBlackBg, hasStrokes]);

  const pushSnapshot = useCallback(() => {
    const ctxs = getContexts();
    if (!ctxs) return;
    const { visual, sketch, vCtx, sCtx } = ctxs;

    const snap: CanvasSnapshot = {
      visual: vCtx.getImageData(0, 0, visual.width, visual.height),
      sketch: sCtx.getImageData(0, 0, sketch.width, sketch.height),
      hasStrokes: hasStrokesRef.current,
    };
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), snap];
    setCanUndo(historyRef.current.length > 0);
  }, [getContexts]);

  const beginStroke = useCallback(
    (pt: Point, color: string, brushSize: number, isEraser = false) => {
      pushSnapshot();
      isDrawingRef.current = true;
      lastPointRef.current = pt;
      midPointRef.current = pt;

      const vCtx = visualCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      const sCtx = sketchCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      if (!vCtx || !sCtx) return;

      // Draw initial dot on Layer 1 (neon glow)
      vCtx.save();
      if (isEraser) {
        vCtx.globalCompositeOperation = 'destination-out';
        vCtx.fillStyle = 'rgba(0,0,0,1)';
        vCtx.beginPath();
        vCtx.arc(pt.x, pt.y, brushSize * 1.4, 0, Math.PI * 2);
        vCtx.fill();
      } else {
        vCtx.globalCompositeOperation = 'source-over';
        vCtx.shadowColor = color;
        vCtx.shadowBlur = Math.max(12, brushSize * 1.6);
        vCtx.fillStyle = color;
        vCtx.beginPath();
        vCtx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
        vCtx.fill();
      }
      vCtx.restore();

      // Draw crisp initial dot on Layer 2 (pure sketch)
      sCtx.save();
      sCtx.globalCompositeOperation = 'source-over';
      sCtx.fillStyle = isEraser ? '#000000' : color;
      sCtx.beginPath();
      sCtx.arc(pt.x, pt.y, isEraser ? brushSize * 1.4 : brushSize / 2, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.restore();

      if (!isEraser) updateHasStrokes(true);
    },
    [pushSnapshot, updateHasStrokes]
  );

  const moveStroke = useCallback(
    (pt: Point, color: string, brushSize: number, isEraser = false) => {
      if (!isDrawingRef.current || !lastPointRef.current || !midPointRef.current) {
        beginStroke(pt, color, brushSize, isEraser);
        return;
      }

      const vCtx = visualCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      const sCtx = sketchCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      if (!vCtx || !sCtx) return;

      const prevPt = lastPointRef.current;
      const prevMid = midPointRef.current;
      const newMid = {
        x: (prevPt.x + pt.x) / 2,
        y: (prevPt.y + pt.y) / 2,
      };

      // Layer 1: Neon glowing smooth stroke
      vCtx.save();
      vCtx.lineCap = 'round';
      vCtx.lineJoin = 'round';
      if (isEraser) {
        vCtx.globalCompositeOperation = 'destination-out';
        vCtx.strokeStyle = 'rgba(0,0,0,1)';
        vCtx.lineWidth = brushSize * 2.8;
      } else {
        vCtx.globalCompositeOperation = 'source-over';
        vCtx.strokeStyle = color;
        vCtx.lineWidth = brushSize;
        vCtx.shadowColor = color;
        vCtx.shadowBlur = Math.max(14, brushSize * 1.8);
      }
      vCtx.beginPath();
      vCtx.moveTo(prevMid.x, prevMid.y);
      vCtx.quadraticCurveTo(prevPt.x, prevPt.y, newMid.x, newMid.y);
      vCtx.stroke();

      // Inner bright core for neon depth
      if (!isEraser) {
        vCtx.shadowBlur = 0;
        vCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        vCtx.lineWidth = Math.max(1.5, brushSize * 0.28);
        vCtx.beginPath();
        vCtx.moveTo(prevMid.x, prevMid.y);
        vCtx.quadraticCurveTo(prevPt.x, prevPt.y, newMid.x, newMid.y);
        vCtx.stroke();
      }
      vCtx.restore();

      // Layer 2: Pure flat stroke on solid black background (zero glow/artifacts)
      sCtx.save();
      sCtx.globalCompositeOperation = 'source-over';
      sCtx.lineCap = 'round';
      sCtx.lineJoin = 'round';
      sCtx.strokeStyle = isEraser ? '#000000' : color;
      sCtx.lineWidth = isEraser ? brushSize * 2.8 : brushSize;
      sCtx.beginPath();
      sCtx.moveTo(prevMid.x, prevMid.y);
      sCtx.quadraticCurveTo(prevPt.x, prevPt.y, newMid.x, newMid.y);
      sCtx.stroke();
      sCtx.restore();

      lastPointRef.current = pt;
      midPointRef.current = newMid;
      if (!isEraser) updateHasStrokes(true);
    },
    [beginStroke, updateHasStrokes]
  );

  const endStroke = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    midPointRef.current = null;
  }, []);

  const eraseArea = useCallback(
    (pt: Point, radius: number) => {
      if (!isDrawingRef.current) {
        pushSnapshot();
        isDrawingRef.current = true;
      }
      const vCtx = visualCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      const sCtx = sketchCanvasRef.current?.getContext('2d', { willReadFrequently: true });
      if (!vCtx || !sCtx) return;

      vCtx.save();
      vCtx.globalCompositeOperation = 'destination-out';
      vCtx.beginPath();
      vCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      vCtx.fill();
      vCtx.restore();

      sCtx.save();
      sCtx.globalCompositeOperation = 'source-over';
      sCtx.fillStyle = '#000000';
      sCtx.beginPath();
      sCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.restore();
    },
    [pushSnapshot]
  );

  const fillAt = useCallback(
    (pt: Point, color: string) => {
      const ctxs = getContexts();
      if (!ctxs) return false;
      pushSnapshot();
      const filledSketch = floodFillCanvas(ctxs.sCtx, pt.x, pt.y, color, 45);
      const filledVisual = floodFillCanvas(ctxs.vCtx, pt.x, pt.y, color, 45);
      if (filledSketch || filledVisual) {
        updateHasStrokes(true);
        return true;
      }
      // Remove no-op snapshot when nothing was filled
      historyRef.current.pop();
      setCanUndo(historyRef.current.length > 0);
      return false;
    },
    [getContexts, pushSnapshot, updateHasStrokes]
  );

  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    const ctxs = getContexts();
    if (ctxs) {
      ctxs.vCtx.putImageData(snap.visual, 0, 0);
      ctxs.sCtx.putImageData(snap.sketch, 0, 0);
    }
    updateHasStrokes(snap.hasStrokes);
    setCanUndo(historyRef.current.length > 0);
  }, [getContexts, updateHasStrokes]);

  const clearAll = useCallback(() => {
    const ctxs = getContexts();
    if (!ctxs) return;
    pushSnapshot();
    ctxs.vCtx.clearRect(0, 0, ctxs.visual.width, ctxs.visual.height);
    ensureSketchBlackBg(ctxs.sCtx, ctxs.sketch.width, ctxs.sketch.height);
    updateHasStrokes(false);
  }, [ensureSketchBlackBg, getContexts, pushSnapshot, updateHasStrokes]);

  /**
   * Extracts Layer 2 (Pure Sketch Canvas) cleanly without camera feed or UI.
   * When invertForScribble=true, converts colored strokes on black into crisp dark lines on white
   * (or keeps white-on-black if false) depending on ControlNet preprocessor.
   */
  const exportSketchBase64 = useCallback((invertToWhiteBg = false): string => {
    const sketch = sketchCanvasRef.current;
    if (!sketch || sketch.width === 0 || sketch.height === 0) return '';

    // Normalize output size to 1024px wide (maintaining aspect ratio) for crisp AI ControlNet conditioning
    const targetW = 1024;
    const targetH = Math.max(512, Math.round((sketch.height / sketch.width) * targetW));
    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(sketch, 0, 0, targetW, targetH);

    if (invertToWhiteBg) {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (lum > 18) {
          // Dark crisp scribble line
          const v = Math.max(0, 255 - Math.min(255, lum * 2.2));
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        } else {
          // Pure white background
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        }
        d[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    return out.toDataURL('image/png');
  }, []);

  /**
   * Captures a composite frame combining the mirrored camera person/room + Layer 1 neon strokes
   * (excluding UI panels and hand-tracking skeleton HUD) for person-inclusive AI rendering.
   */
  const exportCompositeBase64 = useCallback(
    (videoEl: HTMLVideoElement | null): string => {
      const visual = visualCanvasRef.current;
      if (!visual || visual.width === 0 || visual.height === 0) return '';

      const targetW = 1024;
      const targetH = Math.max(512, Math.round((visual.height / visual.width) * targetW));
      const out = document.createElement('canvas');
      out.width = targetW;
      out.height = targetH;
      const ctx = out.getContext('2d')!;

      // Base background
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, targetW, targetH);

      // Draw mirrored webcam video using cover-fit math if camera is active
      if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const scale = Math.max(targetW / vw, targetH / vh);
        const drawW = vw * scale;
        const drawH = vh * scale;
        const dx = (targetW - drawW) / 2;
        const dy = (targetH - drawH) / 2;

        ctx.save();
        ctx.translate(targetW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, dx, dy, drawW, drawH);
        ctx.restore();
      }

      // Composite user's neon drawing strokes on top (no UI, no skeleton HUD)
      ctx.drawImage(visual, 0, 0, targetW, targetH);
      return out.toDataURL('image/jpeg', 0.92);
    },
    []
  );

  return {
    visualCanvasRef,
    sketchCanvasRef,
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
  };
}
