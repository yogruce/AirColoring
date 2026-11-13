import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '25mb' }));

interface RenderRequestBody {
  sketchBase64: string;
  sketchOnlyBase64?: string;
  provider: 'gemini' | 'fal' | 'replicate' | 'comfyui' | 'demo';
  includePerson?: boolean;
  apiKey?: string;
  comfyUrl?: string;
  prompt: string;
  negativePrompt: string;
  preprocessor?: 'invert' | 'scribble_hed';
  controlWeight?: number;
  denoisingStrength?: number;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      fal: Boolean(process.env.FAL_KEY),
      replicate: Boolean(process.env.REPLICATE_API_TOKEN),
      comfyui: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
    },
  });
});

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return {
    mimeType: 'image/png',
    data: dataUrl.replace(/^data:image\/\w+;base64,/, ''),
  };
}

async function renderWithGemini(body: RenderRequestBody, apiKey: string): Promise<string> {
  const primaryImg = parseDataUrl(body.sketchBase64);
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    {
      text: `${body.prompt}\n\nAvoid: ${body.negativePrompt}`,
    },
    {
      inlineData: {
        mimeType: primaryImg.mimeType,
        data: primaryImg.data,
      },
    },
  ];

  if (body.includePerson && body.sketchOnlyBase64) {
    const sketchImg = parseDataUrl(body.sketchOnlyBase64);
    parts[0] = {
      text: `Image 1 is the live camera photo of the person with their glowing air-drawn sketch overlaid. Image 2 shows the exact isolated sketch lines to transform. ${body.prompt}\n\nAvoid: ${body.negativePrompt}`,
    };
    parts.push({
      inlineData: {
        mimeType: sketchImg.mimeType,
        data: sketchImg.data,
      },
    });
  }

  const modelsToTry = ['gemini-2.5-flash-image', 'gemini-2.0-flash-exp-image-generation'];
  let lastError = 'Gemini image generation failed.';

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      lastError = `Gemini API (${model}, ${response.status}): ${errText}`;
      if (response.status === 404 || response.status === 400) {
        continue;
      }
      throw new Error(lastError);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };

    const candidateParts = data.candidates?.[0]?.content?.parts || [];
    const imgPart = candidateParts.find((p) => p.inlineData?.data);
    if (imgPart?.inlineData?.data) {
      const mime = imgPart.inlineData.mimeType || 'image/png';
      return `data:${mime};base64,${imgPart.inlineData.data}`;
    }

    const textReply = candidateParts.find((p) => p.text)?.text;
    lastError = textReply
      ? `Gemini (${model}) returned text without an image: ${textReply.slice(0, 180)}`
      : `Gemini (${model}) did not return an image.`;
  }

  throw new Error(lastError);
}

async function renderWithFal(body: RenderRequestBody, key: string): Promise<string> {
  const endpoint = body.includePerson
    ? 'https://fal.run/fal-ai/flux/dev/image-to-image'
    : 'https://fal.run/fal-ai/sdxl-controlnet-union';

  const payload = body.includePerson
    ? {
        image_url: body.sketchBase64,
        prompt: body.prompt,
        strength: body.denoisingStrength ?? 0.72,
        num_inference_steps: 32,
        guidance_scale: 3.5,
        enable_safety_checker: true,
        output_format: 'png',
      }
    : {
        prompt: body.prompt,
        negative_prompt: body.negativePrompt,
        image_url: body.sketchBase64,
        controlnet_conditioning_scale: body.controlWeight ?? 0.8,
        strength: body.denoisingStrength ?? 0.8,
        num_inference_steps: 28,
        guidance_scale: 7.5,
        enable_safety_checker: true,
      };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fal.ai API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    images?: Array<{ url?: string }>;
    image?: { url?: string };
  };

  const url = data.images?.[0]?.url || data.image?.url;
  if (!url) {
    throw new Error('Fal.ai response did not include an output image URL.');
  }
  return url;
}

async function renderWithReplicate(body: RenderRequestBody, token: string): Promise<string> {
  const replicateBody = body.includePerson
    ? {
        version: '39ed7ab4a7f6d1c8a3c0a4b3efc216259e8d47b67b14d3f57242bb590b957608',
        input: {
          image: body.sketchBase64,
          prompt: body.prompt,
          negative_prompt: body.negativePrompt,
          prompt_strength: body.denoisingStrength ?? 0.72,
          num_inference_steps: 28,
        },
      }
    : {
        version: '435061a1b5a4c1e26740464bf786efdfa9cb3a3ac488595a2de23e143fdb0117',
        input: {
          image: body.sketchBase64,
          prompt: body.prompt,
          n_prompt: body.negativePrompt,
          scale: 9.0,
          ddim_steps: 25,
          num_samples: '1',
          image_resolution: '768',
        },
      };

  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify(replicateBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Replicate API error (${createRes.status}): ${errText}`);
  }

  let prediction = (await createRes.json()) as {
    id: string;
    status: string;
    output?: string[] | string;
    error?: string;
    urls?: { get?: string };
  };

  const pollUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
  const started = Date.now();
  while (
    (prediction.status === 'starting' || prediction.status === 'processing') &&
    Date.now() - started < 90_000
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Replicate polling error (${pollRes.status})`);
    }
    prediction = (await pollRes.json()) as typeof prediction;
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(prediction.error || `Replicate prediction ended with status: ${prediction.status}`);
  }

  const output = Array.isArray(prediction.output)
    ? prediction.output[prediction.output.length - 1]
    : prediction.output;

  if (!output) {
    throw new Error('Replicate response did not contain an output image.');
  }
  return output;
}

async function renderWithComfyUI(body: RenderRequestBody, baseUrl: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error('Geçersiz ComfyUI sunucu adresi.');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('ComfyUI adresi yalnızca http:// veya https:// olabilir.');
  }

  const cleanBase = parsedUrl.toString().replace(/\/+$/, '');
  const { mimeType, data: base64Only } = parseDataUrl(body.sketchBase64);
  const buffer = Buffer.from(base64Only, 'base64');

  const form = new FormData();
  form.append('image', new Blob([buffer], { type: mimeType }), `air_sketch_${Date.now()}.png`);
  form.append('overwrite', 'true');

  const uploadRes = await fetch(`${cleanBase}/upload/image`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    body: form,
  });

  if (!uploadRes.ok) {
    throw new Error(`ComfyUI image upload failed (${uploadRes.status}). Is ComfyUI running at ${cleanBase}?`);
  }

  const uploadJson = (await uploadRes.json()) as { name: string };
  const workflow = body.includePerson
    ? {
        '1': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
        },
        '3': {
          class_type: 'LoadImage',
          inputs: { image: uploadJson.name },
        },
        '4': {
          class_type: 'CLIPTextEncode',
          inputs: { text: body.prompt, clip: ['1', 1] },
        },
        '5': {
          class_type: 'CLIPTextEncode',
          inputs: { text: body.negativePrompt, clip: ['1', 1] },
        },
        '7': {
          class_type: 'VAEEncode',
          inputs: { pixels: ['3', 0], vae: ['1', 2] },
        },
        '8': {
          class_type: 'KSampler',
          inputs: {
            seed: Math.floor(Math.random() * 1_000_000_000),
            steps: 24,
            cfg: 7.5,
            sampler_name: 'euler',
            scheduler: 'normal',
            denoise: body.denoisingStrength ?? 0.72,
            model: ['1', 0],
            positive: ['4', 0],
            negative: ['5', 0],
            latent_image: ['7', 0],
          },
        },
        '9': {
          class_type: 'VAEDecode',
          inputs: { samples: ['8', 0], vae: ['1', 2] },
        },
        '10': {
          class_type: 'SaveImage',
          inputs: { filename_prefix: 'AirColoringPro_Scene', images: ['9', 0] },
        },
      }
    : {
        '1': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
        },
        '2': {
          class_type: 'ControlNetLoader',
          inputs: { control_net_name: 'controlnet-scribble-sdxl-1.0.safetensors' },
        },
        '3': {
          class_type: 'LoadImage',
          inputs: { image: uploadJson.name },
        },
        '4': {
          class_type: 'CLIPTextEncode',
          inputs: { text: body.prompt, clip: ['1', 1] },
        },
        '5': {
          class_type: 'CLIPTextEncode',
          inputs: { text: body.negativePrompt, clip: ['1', 1] },
        },
        '6': {
          class_type: 'ControlNetApplyAdvanced',
          inputs: {
            positive: ['4', 0],
            negative: ['5', 0],
            control_net: ['2', 0],
            image: ['3', 0],
            strength: body.controlWeight ?? 0.8,
            start_percent: 0.0,
            end_percent: 1.0,
          },
        },
        '7': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 1024, height: 768, batch_size: 1 },
        },
        '8': {
          class_type: 'KSampler',
          inputs: {
            seed: Math.floor(Math.random() * 1_000_000_000),
            steps: 24,
            cfg: 7.5,
            sampler_name: 'euler',
            scheduler: 'normal',
            denoise: body.denoisingStrength ?? 0.8,
            model: ['1', 0],
            positive: ['6', 0],
            negative: ['6', 1],
            latent_image: ['7', 0],
          },
        },
        '9': {
          class_type: 'VAEDecode',
          inputs: { samples: ['8', 0], vae: ['1', 2] },
        },
        '10': {
          class_type: 'SaveImage',
          inputs: { filename_prefix: 'AirColoringPro', images: ['9', 0] },
        },
      };

  const queueRes = await fetch(`${cleanBase}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text();
    throw new Error(`ComfyUI prompt queue failed (${queueRes.status}): ${errText}`);
  }

  const { prompt_id } = (await queueRes.json()) as { prompt_id: string };
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    await new Promise((r) => setTimeout(r, 1500));
    const histRes = await fetch(`${cleanBase}/history/${prompt_id}`);
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<
      string,
      { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }
    >;
    const entry = hist[prompt_id];
    const img = entry?.outputs?.['10']?.images?.[0];
    if (img) {
      const qs = new URLSearchParams({
        filename: img.filename,
        subfolder: img.subfolder || '',
        type: img.type || 'output',
      });
      return `${cleanBase}/view?${qs.toString()}`;
    }
  }

  throw new Error('ComfyUI render timed out after 120s.');
}

app.post('/api/render', async (req, res) => {
  const started = Date.now();
  try {
    const body = req.body as RenderRequestBody;
    if (!body?.sketchBase64 || !body.sketchBase64.startsWith('data:image/')) {
      res.status(400).json({ error: 'INVALID_SKETCH', message: 'Valid Base64 sketch image is required.' });
      return;
    }

    let imageUrl = '';
    if (body.provider === 'gemini') {
      const key = body.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!key) {
        res.status(400).json({
          error: 'API_KEY_MISSING',
          message:
            'Gemini API anahtarı (GEMINI_API_KEY) eksik. AI Config içinden Gemini API Key girin veya Demo önizleme kullanın.',
        });
        return;
      }
      imageUrl = await renderWithGemini(body, key);
    } else if (body.provider === 'fal') {
      const key = body.apiKey?.trim() || process.env.FAL_KEY?.trim();
      if (!key) {
        res.status(400).json({
          error: 'API_KEY_MISSING',
          message: 'Fal.ai API key is not configured. Add FAL_KEY in Settings or switch to Demo Simulation Mode.',
        });
        return;
      }
      imageUrl = await renderWithFal(body, key);
    } else if (body.provider === 'replicate') {
      const token = body.apiKey?.trim() || process.env.REPLICATE_API_TOKEN?.trim();
      if (!token) {
        res.status(400).json({
          error: 'API_KEY_MISSING',
          message:
            'Replicate API token is not configured. Add REPLICATE_API_TOKEN in Settings or switch to Demo Simulation Mode.',
        });
        return;
      }
      imageUrl = await renderWithReplicate(body, token);
    } else if (body.provider === 'comfyui') {
      const url = body.comfyUrl?.trim() || process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
      imageUrl = await renderWithComfyUI(body, url);
    } else {
      res.status(400).json({ error: 'UNSUPPORTED_PROVIDER', message: 'Use client-side demo mode or fal/replicate/comfyui.' });
      return;
    }

    res.json({
      imageUrl,
      provider: body.provider,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown render error';
    res.status(502).json({ error: 'RENDER_FAILED', message });
  }
});

// Serve production build if available
const distDir = path.resolve(__dirname, '../dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[AirColoring Server] Listening on http://localhost:${PORT}`);
});
