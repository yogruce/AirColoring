import type { DrawTriggerMode, GestureState, HandLandmark, Point } from '../types/app';

export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16],// Ring
  [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
  [5, 9], [9, 13], [13, 17],            // Palm arch
];

export interface CoverProjection {
  viewportWidth: number;
  viewportHeight: number;
  videoWidth: number;
  videoHeight: number;
  mirror: boolean;
}

export function distance2D(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distance3D(a: HandLandmark, b: HandLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z - b.z) * 0.65;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Maps normalized MediaPipe coordinates [0..1] onto the screen matching CSS `object-cover`
 * and `-scale-x-100` mirroring so the drawn line aligns pixel-for-pixel with the user's finger.
 */
export function projectLandmarkToScreen(
  lm: HandLandmark,
  proj: CoverProjection
): Point {
  const { viewportWidth: vw, viewportHeight: vh, videoWidth, videoHeight, mirror } = proj;
  const srcW = videoWidth > 0 ? videoWidth : vw;
  const srcH = videoHeight > 0 ? videoHeight : vh;
  const scale = Math.max(vw / srcW, vh / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetX = (vw - drawW) / 2;
  const offsetY = (vh - drawH) / 2;

  const nx = mirror ? 1 - lm.x : lm.x;
  return {
    x: offsetX + nx * drawW,
    y: offsetY + lm.y * drawH,
  };
}

/**
 * Velocity-adaptive EMA smoothing: keeps slow strokes ultra-smooth while eliminating lag on fast strokes.
 */
export function smoothPointAdaptive(
  prev: Point | null,
  next: Point,
  baseAlpha = 0.55
): Point {
  if (!prev) return next;
  const dist = distance2D(prev, next);
  // Boost responsiveness when moving quickly (> 14px/frame)
  const velocityBoost = Math.min(0.35, (dist / 45) * 0.35);
  const alpha = Math.max(0.2, Math.min(0.92, baseAlpha + velocityBoost));
  return {
    x: prev.x + alpha * (next.x - prev.x),
    y: prev.y + alpha * (next.y - prev.y),
  };
}

function isFingerStrictlyExtended(
  landmarks: HandLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const wrist = landmarks[0];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  const mcp = landmarks[mcpIdx];

  const tipWrist = distance2D(wrist, tip);
  const pipWrist = distance2D(wrist, pip);
  const mcpWrist = distance2D(wrist, mcp);

  const tipMcp = distance2D(mcp, tip);
  const pipMcp = distance2D(mcp, pip);

  return (
    tipWrist > pipWrist * 1.1 &&
    tipWrist > mcpWrist * 1.22 &&
    tipMcp > pipMcp * 1.32
  );
}

function isFingerCurled(
  landmarks: HandLandmark[],
  tipIdx: number,
  pipIdx: number,
  mcpIdx: number
): boolean {
  const wrist = landmarks[0];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  const mcp = landmarks[mcpIdx];

  const tipWrist = distance2D(wrist, tip);
  const pipWrist = distance2D(wrist, pip);
  const tipMcp = distance2D(mcp, tip);
  const pipMcp = distance2D(mcp, pip);

  return tipWrist < pipWrist * 1.06 || tipMcp < pipMcp * 1.18;
}

function isThumbExtended(landmarks: HandLandmark[]): boolean {
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];

  const palmSpan = Math.max(distance2D(indexMcp, pinkyMcp), 0.05);
  return (
    distance2D(thumbTip, pinkyMcp) > palmSpan * 1.2 &&
    distance2D(thumbTip, indexMcp) > palmSpan * 0.5 &&
    distance2D(thumbTip, landmarks[0]) > distance2D(thumbIp, landmarks[0])
  );
}

export interface ClassifiedHand {
  gesture: GestureState;
  pinching: boolean;
  indexTipScreen: Point;
  thumbTipScreen: Point;
  pinchPenScreen: Point;
  palmCenterScreen: Point;
  fingerStates: {
    thumb: boolean;
    index: boolean;
    middle: boolean;
    ring: boolean;
    pinky: boolean;
  };
  confidences: {
    overall: number;
    wrist: number;
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
}

function clampPct(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

export interface NormalizedBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/**
 * Rejects anatomically impossible ghost/beard detections based on palm proportions.
 */
export function isPlausibleHandGeometry(landmarks: HandLandmark[]): boolean {
  if (landmarks.length < 21) return false;
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const pinkyMcp = landmarks[17];

  const palmLen = distance2D(wrist, middleMcp);
  const palmWidth = distance2D(indexMcp, pinkyMcp);
  if (palmLen < 0.055 || palmWidth < 0.04) return false;

  const aspect = palmWidth / palmLen;
  if (aspect < 0.32 || aspect > 1.4) return false;

  // Reject degenerate detections where fingertips collapse onto the wrist
  const indexReach = distance2D(wrist, landmarks[8]);
  const pinkyReach = distance2D(wrist, landmarks[20]);
  if (indexReach < palmLen * 0.65 && pinkyReach < palmLen * 0.65) return false;

  return true;
}

/**
 * Filters out false-positive hand detections inside the user's face/beard bounding box
 * unless the model has overwhelming (> 0.94) confidence of a real foreground hand.
 */
export function isGhostInFaceRegion(
  landmarks: HandLandmark[],
  faceBoxes: NormalizedBox[],
  score?: number
): boolean {
  if (faceBoxes.length === 0) return false;
  const wrist = landmarks[0];
  const palmCenter = landmarks[9];

  for (const box of faceBoxes) {
    const padX = (box.xMax - box.xMin) * 0.15;
    const padTop = (box.yMax - box.yMin) * 0.1;
    // Extend slightly below chin to cover beard region
    const padBottom = (box.yMax - box.yMin) * 0.35;

    const inBox = (pt: Point) =>
      pt.x >= box.xMin - padX &&
      pt.x <= box.xMax + padX &&
      pt.y >= box.yMin - padTop &&
      pt.y <= box.yMax + padBottom;

    if (inBox(palmCenter) || inBox(wrist)) {
      if ((score ?? 0.8) < 0.94) {
        return true;
      }
    }
  }
  return false;
}

export function classifySingleHand(
  landmarks: HandLandmark[],
  projection: CoverProjection,
  options: {
    drawTriggerMode: DrawTriggerMode;
    wasPinching?: boolean;
    isHoldActive?: boolean;
  }
): ClassifiedHand {
  const {
    drawTriggerMode,
    wasPinching = false,
    isHoldActive = false,
  } = options;

  const thumb = isThumbExtended(landmarks);
  const index = isFingerStrictlyExtended(landmarks, 8, 6, 5);
  const middle = isFingerStrictlyExtended(landmarks, 12, 10, 9);
  const ring = isFingerStrictlyExtended(landmarks, 16, 14, 13);
  const pinky = isFingerStrictlyExtended(landmarks, 20, 18, 17);

  const middleCurled = isFingerCurled(landmarks, 12, 10, 9);
  const ringCurled = isFingerCurled(landmarks, 16, 14, 13);
  const pinkyCurled = isFingerCurled(landmarks, 20, 18, 17);

  // Robust 3D palm scale + hysteresis; reject tiny/degenerate ghost detections
  const rawPalmScale = Math.max(
    distance3D(landmarks[0], landmarks[9]),
    distance3D(landmarks[5], landmarks[17])
  );
  const validHandGeometry = rawPalmScale >= 0.045;
  const handScale = Math.max(rawPalmScale, 0.001);
  const pinchDist = distance3D(landmarks[4], landmarks[8]) / handScale;
  const pinchThreshold = wasPinching ? 0.45 : 0.34;
  const pinching = validHandGeometry && pinchDist < pinchThreshold;

  const indexTipScreen = projectLandmarkToScreen(landmarks[8], projection);
  const thumbTipScreen = projectLandmarkToScreen(landmarks[4], projection);
  // Weighted toward index finger tip so pen tip stays sharp and predictable
  const pinchPenScreen: Point = {
    x: indexTipScreen.x * 0.72 + thumbTipScreen.x * 0.28,
    y: indexTipScreen.y * 0.72 + thumbTipScreen.y * 0.28,
  };
  const palmCenterScreen = projectLandmarkToScreen(landmarks[9], projection);

  let gesture: GestureState = 'IDLE';
  const allFiveOpen = thumb && index && middle && ring && pinky;

  if (drawTriggerMode === 'touch_hold') {
    if (isHoldActive) {
      gesture = 'DRAW';
    } else if (allFiveOpen) {
      gesture = 'ERASE';
    } else if (pinching) {
      gesture = 'PINCH';
    } else {
      gesture = 'HOVER';
    }
  } else if (drawTriggerMode === 'pinch_pen') {
    if (pinching) {
      gesture = 'DRAW';
    } else if (allFiveOpen) {
      gesture = 'ERASE';
    } else {
      gesture = 'HOVER';
    }
  } else {
    if (pinching) {
      gesture = 'PINCH';
    } else if (allFiveOpen) {
      gesture = 'ERASE';
    } else if (index && middleCurled && ringCurled && pinkyCurled) {
      gesture = 'DRAW';
    } else if (index) {
      gesture = 'HOVER';
    }
  }

  const lmScore = (indices: number[]): number => {
    let sum = 0;
    for (const idx of indices) {
      const lm = landmarks[idx];
      const inBounds = lm.x >= 0.02 && lm.x <= 0.98 && lm.y >= 0.02 && lm.y <= 0.98 ? 1 : 0.65;
      const vis = lm.visibility !== undefined ? lm.visibility : 0.98;
      sum += inBounds * vis * 100;
    }
    return clampPct(sum / indices.length);
  };

  const wrist = lmScore([0, 1, 5, 9, 13, 17]);
  const thumbScore = lmScore([2, 3, 4]);
  const indexScore = lmScore([5, 6, 7, 8]);
  const middleScore = lmScore([9, 10, 11, 12]);
  const ringScore = lmScore([13, 14, 15, 16]);
  const pinkyScore = lmScore([17, 18, 19, 20]);
  const overall = clampPct(
    (wrist + thumbScore + indexScore + middleScore + ringScore + pinkyScore) / 6
  );

  return {
    gesture,
    pinching,
    indexTipScreen,
    thumbTipScreen,
    pinchPenScreen,
    palmCenterScreen,
    fingerStates: { thumb, index, middle, ring, pinky },
    confidences: {
      overall,
      wrist,
      thumb: thumbScore,
      index: indexScore,
      middle: middleScore,
      ring: ringScore,
      pinky: pinkyScore,
    },
  };
}

export function isTwoHandFramingGesture(allHands: HandLandmark[][]): boolean {
  if (allHands.length < 2) return false;
  const h1 = allHands[0];
  const h2 = allHands[1];

  const h1Thumb = isThumbExtended(h1);
  const h1Index = isFingerStrictlyExtended(h1, 8, 6, 5);
  const h2Thumb = isThumbExtended(h2);
  const h2Index = isFingerStrictlyExtended(h2, 8, 6, 5);

  if (!(h1Thumb && h1Index && h2Thumb && h2Index)) return false;

  const wristDist = distance2D(h1[0], h2[0]);
  return wristDist > 0.22;
}
