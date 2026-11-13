import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceDetector, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { DrawTriggerMode, GestureState, HandLandmark, HandTelemetry, Point } from '../types/app';
import {
  HAND_CONNECTIONS,
  classifySingleHand,
  distance2D,
  isGhostInFaceRegion,
  isPlausibleHandGeometry,
  isTwoHandFramingGesture,
  projectLandmarkToScreen,
  smoothPointAdaptive,
  type CoverProjection,
  type NormalizedBox,
} from '../utils/gesture';

export type CameraStatus = 'initializing' | 'active' | 'denied' | 'unavailable';

interface UseHandTrackerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hudCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  touchHoldActiveRef: React.RefObject<boolean>;
  enabled: boolean;
  brushColor: string;
  brushSize: number;
  drawTriggerMode: DrawTriggerMode;
  minMoveThreshold: number;
  smoothingAlpha: number;
  viewportWidth: number;
  viewportHeight: number;
  onTelemetry: (telemetry: HandTelemetry) => void;
  onDrawPoint: (pt: Point, isStart: boolean) => void;
  onDrawEnd: () => void;
  onErasePoint: (pt: Point) => void;
  onHoverCursor: (pt: Point | null, pinchClick: boolean) => void;
  onTwoHandRenderTrigger: () => void;
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// Serializes camera open/close across React StrictMode double-mounts so Windows USB drivers never collide
let cameraQueue: Promise<void> = Promise.resolve();

export function useHandTracker({
  videoRef,
  hudCanvasRef,
  touchHoldActiveRef,
  enabled,
  brushColor,
  brushSize,
  drawTriggerMode,
  minMoveThreshold,
  smoothingAlpha,
  viewportWidth,
  viewportHeight,
  onTelemetry,
  onDrawPoint,
  onDrawEnd,
  onErasePoint,
  onHoverCursor,
  onTwoHandRenderTrigger,
}: UseHandTrackerOptions) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('initializing');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [requestedDeviceId, setRequestedDeviceId] = useState<string>('');
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const selectDevice = useCallback((deviceId: string) => {
    setActiveDeviceId(deviceId);
    setRequestedDeviceId(deviceId);
  }, []);

  const retryCamera = useCallback(() => {
    setCameraAttempt((c) => c + 1);
  }, []);

  const isSpacePressedRef = useRef(false);
  const lastAutoRecoverRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        isSpacePressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    const onWindowBlur = () => {
      isSpacePressedRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  const callbacksRef = useRef({
    onTelemetry,
    onDrawPoint,
    onDrawEnd,
    onErasePoint,
    onHoverCursor,
    onTwoHandRenderTrigger,
  });
  callbacksRef.current = {
    onTelemetry,
    onDrawPoint,
    onDrawEnd,
    onErasePoint,
    onHoverCursor,
    onTwoHandRenderTrigger,
  };

  const styleRef = useRef({
    brushColor,
    brushSize,
    drawTriggerMode,
    minMoveThreshold,
    smoothingAlpha,
    viewportWidth,
    viewportHeight,
  });
  styleRef.current = {
    brushColor,
    brushSize,
    drawTriggerMode,
    minMoveThreshold,
    smoothingAlpha,
    viewportWidth,
    viewportHeight,
  };

  // Start webcam stream with constraint fallback & device enumeration
  useEffect(() => {
    if (!enabled) {
      setCameraStatus('unavailable');
      setCameraError(null);
      const video = videoRef.current;
      if (video) video.srcObject = null;
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    let cleanupTrackListeners: (() => void) | null = null;

    async function acquireStream(): Promise<MediaStream> {
      const primaryConstraints: MediaStreamConstraints = requestedDeviceId
        ? {
            video: {
              deviceId: { exact: requestedDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: false,
          }
        : {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user',
            },
            audio: false,
          };

      try {
        return await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (primaryErr) {
        const errName = primaryErr instanceof Error ? primaryErr.name : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          throw primaryErr;
        }
        // Brief pause in case Windows UVC driver is releasing a previous handle
        await new Promise((r) => setTimeout(r, 250));
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: requestedDeviceId
              ? { deviceId: { exact: requestedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } }
              : { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
            audio: false,
          });
        } catch {
          // Fall through to generic constraints & device enumeration
        }
        try {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (secondErr) {
          // Try enumerating individual cameras if default camera failed
          const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
          const cams = devs.filter((d) => d.kind === 'videoinput' && d.deviceId);
          for (const cam of cams) {
            try {
              return await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: cam.deviceId } },
                audio: false,
              });
            } catch {
              // try next camera
            }
          }
          const labels = cams.map((c) => c.label).filter(Boolean);
          const onlyVirtual =
            labels.length > 0 && labels.every((l) => /obs|virtual|snap|manycam/i.test(l));
          if (onlyVirtual) {
            const virtualErr = new Error(`ONLY_VIRTUAL:${labels.join(', ')}`);
            virtualErr.name = 'NotReadableError';
            throw virtualErr;
          }
          throw secondErr;
        }
      }
    }

    async function initCamera() {
      // Wait for any previous StrictMode cleanup or stream release to finish first
      await cameraQueue;
      if (cancelled) return;

      setCameraStatus('initializing');
      setCameraError(null);

      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraStatus('unavailable');
        setCameraError('Kamera erişimi için HTTPS veya http://localhost adresi gereklidir.');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('unavailable');
        setCameraError(
          'Bu tarayıcı penceresi kamera API (getUserMedia) desteklemiyor. Lütfen http://localhost:5173 adresini Chrome veya Edge ile açın.'
        );
        return;
      }

      try {
        stream = await acquireStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Enumerate cameras and prefer physical webcam over virtual cameras on auto-select
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          if (!cancelled) {
            setVideoDevices(cams);
            const activeTrack = stream.getVideoTracks()[0];
            const activeId = activeTrack?.getSettings()?.deviceId || '';
            const activeLabel = (activeTrack?.label || '').toLowerCase();

            if (!requestedDeviceId && cams.length > 1 && /obs|virtual|snap|manycam/i.test(activeLabel)) {
              const physicalCam = cams.find(
                (c) => c.deviceId && !/obs|virtual|snap|manycam/i.test(c.label)
              );
              if (physicalCam && physicalCam.deviceId !== activeId) {
                stream.getTracks().forEach((t) => t.stop());
                await new Promise((r) => setTimeout(r, 120));
                setRequestedDeviceId(physicalCam.deviceId);
                return;
              }
            }

            if (activeId) {
              setActiveDeviceId(activeId);
            }
          }
        } catch {
          // Device enumeration optional
        }

        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack) {
          const onTrackEnded = () => {
            if (cancelled) return;
            const nowMs = Date.now();
            if (nowMs - lastAutoRecoverRef.current > 12_000) {
              lastAutoRecoverRef.current = nowMs;
              setCameraAttempt((c) => c + 1);
            } else {
              setCameraStatus('unavailable');
              setCameraError(
                'Kamera bağlantısı kesildi veya sürücü akışı sonlandı. "Kamerayı Yeniden Dene" butonuna basın.'
              );
            }
          };
          activeTrack.addEventListener('ended', onTrackEnded);
          cleanupTrackListeners = () => {
            activeTrack.removeEventListener('ended', onTrackEnded);
          };
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await new Promise<void>((resolve) => {
            if (video.readyState >= 1) {
              resolve();
              return;
            }
            const onLoaded = () => {
              video.removeEventListener('loadedmetadata', onLoaded);
              resolve();
            };
            video.addEventListener('loadedmetadata', onLoaded);
          });
          await video.play();
          if (!cancelled) {
            setCameraStatus('active');
            setCameraError(null);
          }
        }
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : '';
        const msg = err instanceof Error ? err.message : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraStatus('denied');
          setCameraError(
            'Kamera izni reddedildi veya bu gömülü tarayıcı kamera izni vermiyor. Adres çubuğundan izin verin ya da http://localhost:5173 adresini Chrome/Edge ile açın.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraStatus('unavailable');
          setCameraError('Bağlı bir web kamerası bulunamadı. Kamera bağlantısını kontrol edip Yeniden Dene butonuna basın.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setCameraStatus('unavailable');
          if (msg.startsWith('ONLY_VIRTUAL:')) {
            const vName = msg.slice('ONLY_VIRTUAL:'.length) || 'OBS Virtual Camera';
            setCameraError(
              `Bu tarayıcı oturumunda fiziksel USB kamera görünmüyor (yalnızca "${vName}" algılanıyor). Antigravity'yi kapatıp açın veya http://localhost:5173 adresini Chrome/Edge/Firefox'ta açın.`
            );
          } else {
            setCameraError('Kamera şu anda başka bir uygulama veya tarayıcı sekmesi tarafından kullanılıyor.');
          }
        } else {
          setCameraStatus('unavailable');
          setCameraError(`Kamera başlatılamadı (${name || 'Hata'}): ${msg || 'Lütfen Chrome/Edge tarayıcısında açın.'}`);
        }
      }
    }

    const initPromise = initCamera();
    cameraQueue = initPromise.catch(() => {});

    return () => {
      cancelled = true;
      cleanupTrackListeners?.();
      cleanupTrackListeners = null;
      cameraQueue = initPromise
        .catch(() => {})
        .then(async () => {
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            stream = null;
            await new Promise((r) => setTimeout(r, 150));
          }
        });
    };
  }, [enabled, videoRef, requestedDeviceId, cameraAttempt]);

  // Load MediaPipe HandLandmarker and run 60fps detection loop
  useEffect(() => {
    if (!enabled || cameraStatus !== 'active') return;

    let landmarker: HandLandmarker | null = null;
    let faceDetector: FaceDetector | null = null;
    let rafId = 0;
    let cancelled = false;

    let smoothedCursor: Point | null = null;
    let prevCursorForVelocity: Point | null = null;
    let lastCommittedDrawPt: Point | null = null;
    let drawStableFrames = 0;
    let wasDrawing = false;
    let wasErasing = false;
    let wasPinching = false;
    let frameHoldStart = 0;
    let frameTriggered = false;

    let fpsFrames = 0;
    let fpsLastTick = performance.now();
    let currentFps = 60;
    let lastVideoTime = -1;
    let lastFrameAdvanceAt = performance.now();
    let stallTriggered = false;
    let lastDetectTs = 0;
    let consecutiveDetectErrors = 0;
    let usingGpuDelegate = true;
    let visionInstance: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
    let lastTelemetryPush = 0;
    let frameIndex = 0;
    let cachedFaceBoxes: NormalizedBox[] = [];

    function handleStreamFreeze(reason: string) {
      if (cancelled || stallTriggered) return;
      stallTriggered = true;
      if (wasDrawing || wasErasing) {
        callbacksRef.current.onDrawEnd();
        wasDrawing = false;
        wasErasing = false;
      }
      const hudCtx = hudCanvasRef.current?.getContext('2d');
      if (hudCtx && hudCanvasRef.current) {
        hudCtx.clearRect(0, 0, hudCanvasRef.current.width, hudCanvasRef.current.height);
      }
      const nowMs = Date.now();
      if (nowMs - lastAutoRecoverRef.current > 15_000) {
        lastAutoRecoverRef.current = nowMs;
        setCameraAttempt((c) => c + 1);
      } else {
        setCameraStatus('unavailable');
        setCameraError(reason);
      }
    }

    async function setupAndLoop() {
      try {
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        } catch {
          vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );
        }
        visionInstance = vision;

        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.76,
            minHandPresenceConfidence: 0.76,
            minTrackingConfidence: 0.55,
          });
          usingGpuDelegate = true;
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.76,
            minHandPresenceConfidence: 0.76,
            minTrackingConfidence: 0.55,
          });
          usingGpuDelegate = false;
        }

        // Load lightweight FaceDetector in parallel to suppress beard/face ghost hands
        FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55,
        })
          .then((fd) => {
            if (cancelled) fd.close();
            else faceDetector = fd;
          })
          .catch(() => {
            // Optional safeguard; geometric hand validator remains active
          });

        if (cancelled) {
          landmarker.close();
          return;
        }
        setModelReady(true);
        setModelError(null);
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        if (!cancelled) {
          setModelError(err instanceof Error ? err.message : 'Failed to load MediaPipe HandLandmarker');
        }
      }
    }

    function drawHandHud(
      ctx: CanvasRenderingContext2D,
      allHands: HandLandmark[][],
      primaryGesture: GestureState,
      cursor: Point | null,
      frameProgress: number,
      proj: CoverProjection
    ) {
      const { viewportWidth: w, viewportHeight: h } = proj;
      ctx.clearRect(0, 0, w, h);

      for (const landmarks of allHands) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.85)';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 10;

        for (const [i, j] of HAND_CONNECTIONS) {
          const a = projectLandmarkToScreen(landmarks[i], proj);
          const b = projectLandmarkToScreen(landmarks[j], proj);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();

        for (let idx = 0; idx < landmarks.length; idx++) {
          const pt = projectLandmarkToScreen(landmarks[idx], proj);
          const x = pt.x;
          const y = pt.y;
          const isIndexTip = idx === 8;
          const isThumbTip = idx === 4;

          ctx.save();
          if (isIndexTip) {
            ctx.fillStyle = styleRef.current.brushColor;
            ctx.shadowColor = styleRef.current.brushColor;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(x, y, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (isThumbTip) {
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(x, y, 5.2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#60a5fa';
            ctx.beginPath();
            ctx.arc(x, y, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (cursor) {
        ctx.save();
        const radius =
          primaryGesture === 'ERASE'
            ? Math.max(24, styleRef.current.brushSize * 2.4)
            : primaryGesture === 'DRAW'
              ? Math.max(8, styleRef.current.brushSize * 0.65)
              : Math.max(13, styleRef.current.brushSize * 0.95);
        ctx.strokeStyle =
          primaryGesture === 'DRAW'
            ? styleRef.current.brushColor
            : primaryGesture === 'ERASE'
              ? '#ff4d6d'
              : primaryGesture === 'PINCH'
                ? '#fbbf24'
                : '#00f0ff';
        ctx.lineWidth = primaryGesture === 'DRAW' ? 2.5 : 1.8;
        ctx.setLineDash(primaryGesture === 'HOVER' ? [5, 4] : []);
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle =
          primaryGesture === 'DRAW'
            ? '#34d399'
            : 'rgba(226, 232, 240, 0.92)';

        const modeHint =
          primaryGesture === 'DRAW'
            ? 'DRAWING'
            : primaryGesture === 'HOVER' && styleRef.current.drawTriggerMode === 'pinch_pen'
              ? 'READY (PINCH TO DRAW)'
              : primaryGesture === 'HOVER' && styleRef.current.drawTriggerMode === 'touch_hold'
                ? 'READY (HOLD PAD TO DRAW)'
                : primaryGesture;

        ctx.fillText(modeHint, cursor.x + radius + 8, cursor.y + 4);
        ctx.restore();
      }

      if (frameProgress > 0 && allHands.length >= 2) {
        ctx.save();
        const cx = w / 2;
        const cy = h / 2;
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(w * 0.16, h * 0.16, w * 0.68, h * 0.68);

        ctx.beginPath();
        ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frameProgress);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 13px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AI RENDER FRAMING...', cx, cy + 70);
        ctx.restore();
      }
    }

    function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      const hudCanvas = hudCanvasRef.current;
      const {
        viewportWidth: vw,
        viewportHeight: vh,
        drawTriggerMode: mode,
        minMoveThreshold: deadzone,
        smoothingAlpha: alpha,
      } = styleRef.current;

      if (hudCanvas && (hudCanvas.width !== vw || hudCanvas.height !== vh) && vw > 0 && vh > 0) {
        hudCanvas.width = vw;
        hudCanvas.height = vh;
      }

      if (video && landmarker && vw > 0 && vh > 0) {
        const now = performance.now();
        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }
        fpsFrames++;
        if (now - fpsLastTick >= 500) {
          currentFps = Math.round((fpsFrames * 1000) / (now - fpsLastTick));
          fpsFrames = 0;
          fpsLastTick = now;
        }

        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          lastFrameAdvanceAt = now;
          frameIndex++;
          try {
            const detectTs = Math.max(lastDetectTs + 1, Math.round(now));
            lastDetectTs = detectTs;

            // Update face bounding boxes every 4th frame so beard/chin region cannot trigger ghost hands
            if (faceDetector && frameIndex % 4 === 0 && video.videoWidth > 0 && video.videoHeight > 0) {
              const fRes = faceDetector.detectForVideo(video, detectTs);
              cachedFaceBoxes = (fRes.detections || [])
                .map((d) => d.boundingBox)
                .filter((b): b is NonNullable<typeof b> => Boolean(b))
                .map((b) => ({
                  xMin: b.originX / video.videoWidth,
                  yMin: b.originY / video.videoHeight,
                  xMax: (b.originX + b.width) / video.videoWidth,
                  yMax: (b.originY + b.height) / video.videoHeight,
                }));
            }

            const t0 = performance.now();
            const result = landmarker.detectForVideo(video, detectTs);
            consecutiveDetectErrors = 0;
            const latencyMs = Math.max(1, Math.round(performance.now() - t0));
            const rawHands = (result.landmarks || []) as HandLandmark[][];
            const handednesses = result.handednesses || [];

            // Strict multi-stage filter: confidence + anatomical palm proportions + anti-beard/face check
            const hands = rawHands.filter((lm, idx) => {
              const score = handednesses[idx]?.[0]?.score;
              if (score !== undefined && score < 0.76) return false;
              if (!isPlausibleHandGeometry(lm)) return false;
              if (isGhostInFaceRegion(lm, cachedFaceBoxes, score)) return false;
              return true;
            });

            let gesture: GestureState = 'IDLE';
            let cursor: Point | null = null;
            let pinching = false;
            let velocity = 0;
            let frameProgress = 0;
            let confidences = {
              overall: 0,
              wrist: 0,
              thumb: 0,
              index: 0,
              middle: 0,
              ring: 0,
              pinky: 0,
            };

            const projection: CoverProjection = {
              viewportWidth: vw,
              viewportHeight: vh,
              videoWidth: video.videoWidth || vw,
              videoHeight: video.videoHeight || vh,
              mirror: true,
            };

            if (hands.length > 0) {
              const isHoldActive = isSpacePressedRef.current || Boolean(touchHoldActiveRef.current);
              const primary = classifySingleHand(hands[0], projection, {
                drawTriggerMode: mode,
                wasPinching,
                isHoldActive,
              });
              confidences = primary.confidences;
              pinching = primary.pinching;

              if (isTwoHandFramingGesture(hands)) {
                gesture = 'FRAME_RENDER';
                drawStableFrames = 0;
                lastCommittedDrawPt = null;
                if (frameHoldStart === 0) frameHoldStart = now;
                const elapsed = now - frameHoldStart;
                frameProgress = Math.min(1, elapsed / 1400);
                if (frameProgress >= 1 && !frameTriggered) {
                  frameTriggered = true;
                  callbacksRef.current.onTwoHandRenderTrigger();
                }
                if (wasDrawing) {
                  callbacksRef.current.onDrawEnd();
                  wasDrawing = false;
                }
                callbacksRef.current.onHoverCursor(null, false);
              } else {
                frameHoldStart = 0;
                frameTriggered = false;
                gesture = primary.gesture;

                const rawPt =
                  gesture === 'ERASE'
                    ? primary.palmCenterScreen
                    : mode === 'pinch_pen'
                      ? primary.pinchPenScreen
                      : primary.indexTipScreen;

                smoothedCursor = smoothPointAdaptive(smoothedCursor, rawPt, alpha);
                cursor = smoothedCursor;

                if (prevCursorForVelocity && cursor) {
                  velocity = Math.round(distance2D(prevCursorForVelocity, cursor));
                }
                prevCursorForVelocity = cursor;

                // Check if air cursor is over a UI button (so pinch clicks UI instead of drawing!)
                let isOverInteractiveUI = false;
                if (cursor) {
                  const el = document.elementFromPoint(cursor.x, cursor.y) as HTMLElement | null;
                  isOverInteractiveUI = Boolean(el?.closest('[data-air-interactive="true"]'));
                }

                // Require 2 consecutive frames for pinch_pen (stops single-frame ghost scribbles), 3 for strict_index
                const requiredFrames = mode === 'strict_index' ? 3 : mode === 'pinch_pen' ? 2 : 1;

                if (gesture === 'DRAW' && cursor && !isOverInteractiveUI) {
                  drawStableFrames++;
                  if (drawStableFrames >= requiredFrames) {
                    const isStart = !wasDrawing;
                    if (
                      isStart ||
                      !lastCommittedDrawPt ||
                      distance2D(lastCommittedDrawPt, cursor) >= deadzone
                    ) {
                      callbacksRef.current.onDrawPoint(cursor, isStart);
                      lastCommittedDrawPt = cursor;
                      wasDrawing = true;
                    }
                    callbacksRef.current.onHoverCursor(null, false);
                  } else {
                    // Still stabilizing — treat visually as hover
                    gesture = 'HOVER';
                    callbacksRef.current.onHoverCursor(cursor, false);
                  }
                } else {
                  drawStableFrames = 0;
                  lastCommittedDrawPt = null;
                  if (wasDrawing) {
                    callbacksRef.current.onDrawEnd();
                    wasDrawing = false;
                  }

                  if (gesture === 'ERASE' && cursor && !isOverInteractiveUI) {
                    callbacksRef.current.onErasePoint(cursor);
                    wasErasing = true;
                    callbacksRef.current.onHoverCursor(null, false);
                  } else {
                    if (wasErasing) {
                      callbacksRef.current.onDrawEnd();
                      wasErasing = false;
                    }
                    if (cursor) {
                      const pinchClickEdge = pinching && !wasPinching;
                      callbacksRef.current.onHoverCursor(cursor, pinchClickEdge);
                    } else {
                      callbacksRef.current.onHoverCursor(null, false);
                    }
                  }
                }
                wasPinching = pinching;
              }
            } else {
              smoothedCursor = null;
              prevCursorForVelocity = null;
              lastCommittedDrawPt = null;
              drawStableFrames = 0;
              frameHoldStart = 0;
              frameTriggered = false;
              wasPinching = false;
              if (wasDrawing || wasErasing) {
                callbacksRef.current.onDrawEnd();
                wasDrawing = false;
                wasErasing = false;
              }
              callbacksRef.current.onHoverCursor(null, false);
            }

            const hudCtx = hudCanvas?.getContext('2d');
            if (hudCtx) {
              drawHandHud(hudCtx, hands, gesture, cursor, frameProgress, projection);
            }

            if (now - lastTelemetryPush >= 75) {
              lastTelemetryPush = now;
              callbacksRef.current.onTelemetry({
                fps: currentFps,
                latencyMs,
                velocity,
                overallConfidence: confidences.overall,
                fingerConfidences: {
                  wrist: confidences.wrist,
                  thumb: confidences.thumb,
                  index: confidences.index,
                  middle: confidences.middle,
                  ring: confidences.ring,
                  pinky: confidences.pinky,
                },
                handsDetected: hands.length,
                gesture,
                cursor,
                pinching,
                frameProgress,
              });
            }
          } catch {
            consecutiveDetectErrors++;
            if (consecutiveDetectErrors >= 6 && usingGpuDelegate && visionInstance) {
              usingGpuDelegate = false;
              consecutiveDetectErrors = 0;
              const oldLandmarker = landmarker;
              landmarker = null;
              oldLandmarker?.close();
              HandLandmarker.createFromOptions(visionInstance, {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
                runningMode: 'VIDEO',
                numHands: 2,
                minHandDetectionConfidence: 0.76,
                minHandPresenceConfidence: 0.76,
                minTrackingConfidence: 0.55,
              })
                .then((cpuLm) => {
                  if (cancelled) cpuLm.close();
                  else landmarker = cpuLm;
                })
                .catch(() => {});
            }
          }
        } else if (now - lastFrameAdvanceAt > 4500) {
          handleStreamFreeze(
            'Kamera akışı dondu veya siyah ekrana düştü. "Kamerayı Yeniden Dene" butonuna basın.'
          );
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    setupAndLoop();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (landmarker) landmarker.close();
      if (faceDetector) faceDetector.close();
    };
  }, [enabled, cameraStatus, videoRef, hudCanvasRef, touchHoldActiveRef]);

  return {
    cameraStatus,
    cameraError,
    videoDevices,
    selectedDeviceId: activeDeviceId,
    setSelectedDeviceId: selectDevice,
    retryCamera,
    modelReady,
    modelError,
  };
}
