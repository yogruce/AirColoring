import type { RenderThemeId } from '../types/app';

interface DemoThemePalette {
  skyStops: [string, string, string, string];
  sunColor: string;
  sunGlow: string;
  skylineColor: string;
  groundTop: string;
  groundBottom: string;
  bodyRgb: [number, number, number];
  rimGlow: string;
  accentStroke: string;
  badgeText: string;
  isNight: boolean;
}

const DEMO_PALETTES: Record<RenderThemeId, DemoThemePalette> = {
  photorealistic: {
    skyStops: ['#1e4e79', '#64a9d8', '#f9d49c', '#fde8b8'],
    sunColor: 'rgba(255, 250, 220, 0.95)',
    sunGlow: 'rgba(255, 210, 130, 0.5)',
    skylineColor: 'rgba(130, 170, 205, 0.42)',
    groundTop: '#58b368',
    groundBottom: '#1d5636',
    bodyRgb: [248, 250, 255],
    rimGlow: '#38bdf8',
    accentStroke: '#ff3b30',
    badgeText: 'THEME: PHOTOREALISTIC FUTURE (DEMO PREVIEW)',
    isNight: false,
  },
  cyberpunk: {
    skyStops: ['#050514', '#160b33', '#3b0764', '#0f172a'],
    sunColor: 'rgba(232, 121, 249, 0.75)',
    sunGlow: 'rgba(6, 182, 212, 0.45)',
    skylineColor: 'rgba(15, 23, 42, 0.85)',
    groundTop: '#0f172a',
    groundBottom: '#020617',
    bodyRgb: [30, 41, 59],
    rimGlow: '#00f0ff',
    accentStroke: '#f43f5e',
    badgeText: 'THEME: CYBERPUNK NEON SCI-FI (DEMO PREVIEW)',
    isNight: true,
  },
  anime_solarpunk: {
    skyStops: ['#0284c7', '#38bdf8', '#bae6fd', '#fef3c7'],
    sunColor: 'rgba(254, 249, 195, 0.95)',
    sunGlow: 'rgba(253, 224, 71, 0.45)',
    skylineColor: 'rgba(125, 211, 252, 0.55)',
    groundTop: '#84cc16',
    groundBottom: '#3f6212',
    bodyRgb: [255, 248, 231],
    rimGlow: '#f59e0b',
    accentStroke: '#ec4899',
    badgeText: 'THEME: SOLARPUNK ANIME (DEMO PREVIEW)',
    isNight: false,
  },
  isometric_3d: {
    skyStops: ['#cbd5e1', '#e2e8f0', '#f1f5f9', '#f8fafc'],
    sunColor: 'rgba(255, 255, 255, 0.9)',
    sunGlow: 'rgba(56, 189, 248, 0.25)',
    skylineColor: 'rgba(148, 163, 184, 0.28)',
    groundTop: '#94a3b8',
    groundBottom: '#64748b',
    bodyRgb: [255, 255, 255],
    rimGlow: '#0ea5e9',
    accentStroke: '#38bdf8',
    badgeText: 'THEME: 3D CONCEPT DIORAMA (DEMO PREVIEW)',
    isNight: false,
  },
};

/**
 * Client-side Demo Simulation renderer used when Demo Mode is active.
 * Adapts sky, ground, lighting, and material palette to the selected RenderThemeId.
 */
export async function generateDemoSustainableRender(
  sketchDataUrl: string,
  themeId: RenderThemeId = 'photorealistic',
  compositeDataUrl?: string
): Promise<string> {
  const palette = DEMO_PALETTES[themeId] || DEMO_PALETTES.photorealistic;

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });

  const img = await loadImage(sketchDataUrl);
  const compositeImg = compositeDataUrl ? await loadImage(compositeDataUrl) : null;

  const w = 1024;
  const h = 768;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  if (compositeImg) {
    // Person + Sketch Composite Mode: preserve person in frame & apply theme grading + luminous sketch transformation
    ctx.drawImage(compositeImg, 0, 0, w, h);

    // Theme atmosphere color-grade overlay
    ctx.save();
    ctx.globalCompositeOperation = themeId === 'cyberpunk' ? 'hard-light' : 'soft-light';
    ctx.globalAlpha = 0.55;
    const grade = ctx.createLinearGradient(0, 0, w, h);
    grade.addColorStop(0, palette.skyStops[0]);
    grade.addColorStop(0.5, palette.skyStops[1]);
    grade.addColorStop(1, palette.skyStops[2]);
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Rim-light halo around the frame matching selected theme
    const halo = ctx.createRadialGradient(w * 0.75, h * 0.2, 40, w * 0.5, h * 0.5, w * 0.72);
    halo.addColorStop(0, palette.sunGlow);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    // Isolated Sketch-only Mode: render themed sky/skyline/ground
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
    sky.addColorStop(0, palette.skyStops[0]);
    sky.addColorStop(0.42, palette.skyStops[1]);
    sky.addColorStop(0.78, palette.skyStops[2]);
    sky.addColorStop(1, palette.skyStops[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.78, h * 0.24, 15, w * 0.78, h * 0.24, 240);
    sun.addColorStop(0, palette.sunColor);
    sun.addColorStop(0.35, palette.sunGlow);
    sun.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    if (themeId === 'cyberpunk') {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 65; i++) {
        const rx = (i * 73) % w;
        const ry = (i * 41) % (h * 0.8);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 8, ry + 26);
        ctx.stroke();
      }
    } else if (themeId !== 'isometric_3d') {
      ctx.fillStyle = themeId === 'anime_solarpunk' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.32)';
      for (let i = 0; i < 6; i++) {
        const cx = 110 + i * 170;
        const cy = 95 + (i % 2) * 38;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 92, themeId === 'anime_solarpunk' ? 32 : 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (themeId === 'isometric_3d') {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.76, w * 0.38, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = palette.skylineColor;
      const towers = [
        [85, 230, 48],
        [155, 270, 38],
        [215, 195, 56],
        [755, 245, 52],
        [830, 290, 62],
        [915, 215, 44],
      ];
      for (const [tx, th, tw] of towers) {
        ctx.beginPath();
        ctx.roundRect(
          tx,
          h * 0.65 - th,
          tw,
          th,
          themeId === 'cyberpunk' ? [4, 4, 0, 0] : [tw / 2, tw / 2, 0, 0]
        );
        ctx.fill();
      }
    }

    const ground = ctx.createLinearGradient(0, h * 0.65, 0, h);
    ground.addColorStop(0, palette.groundTop);
    ground.addColorStop(1, palette.groundBottom);
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.bezierCurveTo(w * 0.32, h * 0.64, w * 0.68, h * 0.78, w, h * 0.7);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Extract Layer 2 Sketch Contours into Themed Architectural Structure
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mctx = maskCanvas.getContext('2d')!;
  mctx.drawImage(img, 0, 0, w, h);

  const sketchData = mctx.getImageData(0, 0, w, h);
  const d = sketchData.data;

  const bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = w;
  bodyCanvas.height = h;
  const bctx = bodyCanvas.getContext('2d')!;
  const bodyImg = bctx.createImageData(w, h);
  const bd = bodyImg.data;

  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum > 24) {
      bd[i] = palette.bodyRgb[0];
      bd[i + 1] = palette.bodyRgb[1];
      bd[i + 2] = palette.bodyRgb[2];
      bd[i + 3] = Math.min(255, lum * 2.2);
    }
  }
  bctx.putImageData(bodyImg, 0, 0);

  // Drop shadow / ambient occlusion
  ctx.save();
  ctx.filter = 'blur(18px)';
  ctx.globalAlpha = palette.isNight ? 0.65 : 0.42;
  ctx.drawImage(bodyCanvas, 12, 22);
  ctx.restore();

  // Volumetric form extrusion from sketch
  ctx.save();
  ctx.filter = themeId === 'isometric_3d' ? 'blur(3px)' : 'blur(6px)';
  ctx.globalAlpha = 0.94;
  for (let offset = -10; offset <= 10; offset += 5) {
    ctx.drawImage(bodyCanvas, offset, offset * 0.4);
  }
  ctx.restore();

  // Theme Rim Light + Sketch Contour
  ctx.save();
  ctx.shadowColor = palette.rimGlow;
  ctx.shadowBlur = themeId === 'cyberpunk' ? 24 : 14;
  ctx.drawImage(bodyCanvas, 0, 0);
  ctx.restore();

  // Accent Trim
  ctx.save();
  ctx.globalAlpha = themeId === 'cyberpunk' ? 0.85 : 0.55;
  ctx.strokeStyle = palette.accentStroke;
  ctx.drawImage(img, 3, 2, w, h);
  ctx.restore();

  // Foreground details (flowers or cyberpunk street reflections)
  if (themeId === 'cyberpunk') {
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 240, 255, 0.35)' : 'rgba(217, 70, 239, 0.35)';
      ctx.fillRect((i * 89) % w, h * 0.78 + ((i * 23) % 140), 48, 3);
    }
  } else if (themeId !== 'isometric_3d') {
    const flowerColors = ['#ff3b30', '#fbbf24', '#f472b6', '#ffffff'];
    for (let i = 0; i < 42; i++) {
      const fx = (i * 97) % w;
      const fy = h * 0.78 + ((i * 53) % (h * 0.2));
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Demo Badge
  ctx.fillStyle = 'rgba(6, 9, 19, 0.78)';
  ctx.beginPath();
  ctx.roundRect(24, h - 54, 430, 32, 8);
  ctx.fill();
  ctx.fillStyle = palette.rimGlow;
  ctx.font = '600 12px "JetBrains Mono", monospace';
  ctx.fillText(palette.badgeText, 36, h - 33);

  return canvas.toDataURL('image/png');
}
