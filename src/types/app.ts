export type ToolMode = 'draw' | 'color' | 'eraser' | 'bucket';

export type DrawTriggerMode = 'touch_hold' | 'pinch_pen' | 'strict_index';

export type GestureState =
  | 'IDLE'
  | 'DRAW'
  | 'HOVER'
  | 'PINCH'
  | 'ERASE'
  | 'FRAME_RENDER';

export type AiProvider = 'gemini' | 'fal' | 'replicate' | 'comfyui' | 'demo';

export type RenderThemeId =
  | 'photorealistic'
  | 'cyberpunk'
  | 'anime_solarpunk'
  | 'isometric_3d';

export interface RenderThemePreset {
  id: RenderThemeId;
  label: string;
  shortLabel: string;
  description: string;
  accentHex: string;
  prompt: string;
  negativePrompt: string;
  recommendedControlWeight: number;
  recommendedDenoising: number;
}

export type ControlNetPreprocessor = 'invert' | 'scribble_hed';

export interface RenderConfig {
  provider: AiProvider;
  themeId: RenderThemeId;
  includePerson: boolean;
  drawTriggerMode: DrawTriggerMode;
  minMoveThreshold: number;
  smoothingAlpha: number;
  apiKey: string;
  comfyUrl: string;
  prompt: string;
  negativePrompt: string;
  preprocessor: ControlNetPreprocessor;
  controlWeight: number;
  denoisingStrength: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandTelemetry {
  fps: number;
  latencyMs: number;
  velocity: number;
  overallConfidence: number;
  fingerConfidences: {
    wrist: number;
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
  handsDetected: number;
  gesture: GestureState;
  cursor: Point | null;
  pinching: boolean;
  frameProgress: number; // 0..1 when two-hand framing gesture is held
}

export interface RenderResult {
  imageUrl: string;
  sketchDataUrl: string;
  provider: AiProvider;
  themeId: RenderThemeId;
  includePerson: boolean;
  prompt: string;
  controlWeight: number;
  denoisingStrength: number;
  durationMs: number;
  isDemo: boolean;
  timestamp: number;
}
