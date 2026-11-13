import type { RenderConfig, RenderThemeId, RenderThemePreset } from '../types/app';

export const MASTER_PROMPT =
  'Transform this hand-drawn sketch into a photorealistic vision of a sustainable, optimistic future. Keep the subject, composition and main shapes of the drawing recognizable, but reimagine it as a high-end futuristic design: smooth organic curved white forms, floor-to-ceiling glass, solar panels, green roofs and integrated plants, subtle smart-technology details, and vibrant red accent elements. Place it in a lush, sunny landscape with flowers, trees and soft grass, with a distant futuristic city skyline in the background. Warm golden hour sunlight, glowing interior lights, clear sky with soft clouds. Professional architectural visualization quality, ultra detailed, cinematic, bright and inspiring mood. No text, no letters, no logos, no watermarks.';

export const NEGATIVE_PROMPT =
  'ugly, deformed, noisy, blurry, low contrast, text, watermark, logo, signature, human face, indoor room, UI elements, bad architecture, dark, dystopian, gloomy.';

export const RENDER_THEMES: RenderThemePreset[] = [
  {
    id: 'photorealistic',
    label: 'Fotorealistik Gelecek',
    shortLabel: 'Fotorealistik',
    description: 'Sürdürülebilir, organik beyaz mimari, güneş panelleri ve altın saat ışığı.',
    accentHex: '#10B981',
    prompt: MASTER_PROMPT,
    negativePrompt: NEGATIVE_PROMPT,
    recommendedControlWeight: 0.8,
    recommendedDenoising: 0.8,
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk Neon Sci-Fi',
    shortLabel: 'Cyberpunk',
    description: 'Yağmurlu gece metropolü, holografik camlar, elektrik mavisi ve magenta neonlar.',
    accentHex: '#D946EF',
    prompt:
      'Transform this hand-drawn sketch into a breathtaking ultra-detailed cyberpunk sci-fi scene. Preserve the exact silhouette, proportions and composition of the sketch, reimagining it with sleek dark anodized titanium, glowing cyan and magenta neon edge lighting, holographic HUD glass panels, cybernetic conduits, and wet reflective streets under a dramatic rainy night skyline. Volumetric neon fog, ray-traced reflections, cinematic blade-runner atmosphere, 8k concept art quality. No text, no letters, no logos, no watermarks.',
    negativePrompt:
      'ugly, deformed, blurry, washed out, pastel, daytime, rustic, low quality, text, watermark, logo, signature, human face, indoor room, UI elements.',
    recommendedControlWeight: 0.82,
    recommendedDenoising: 0.82,
  },
  {
    id: 'anime_solarpunk',
    label: 'Solarpunk Anime (Ghibli)',
    shortLabel: 'Anime Art',
    description: 'El boyaması anime arka plan, rüzgar türbinleri, çiçekli çatılar ve sıcak gökyüzü.',
    accentHex: '#F59E0B',
    prompt:
      'Transform this hand-drawn sketch into a vibrant hand-painted Studio Ghibli inspired solarpunk anime illustration. Keep the main shapes and composition faithful to the sketch, rendered with expressive watercolor and gouache brushwork, warm wooden and ivory eco-structures, blooming rooftop gardens, spinning wind turbines, cozy glowing windows, fluffy cumulus clouds in a deep cerulean sky, and sunlit meadow wildflowers. Masterpiece anime background art, whimsical, serene and luminous. No text, no letters, no logos, no watermarks.',
    negativePrompt:
      'photorealistic, 3d cgi, dark, gritty, horror, deformed, muddy colors, lowres, text, watermark, logo, signature, human face, indoor room, UI elements.',
    recommendedControlWeight: 0.78,
    recommendedDenoising: 0.78,
  },
  {
    id: 'isometric_3d',
    label: '3D Konsept Maket (Octane)',
    shortLabel: '3D Maket',
    description: 'Pürüzsüz clay/seramik 3D stüdyo render, yumuşak gölgeler ve oyuncak maket estetiği.',
    accentHex: '#38BDF8',
    prompt:
      'Transform this hand-drawn sketch into a crisp stylized 3D architectural concept miniature rendered in Octane Render and Blender Cycles. Preserve the exact layout and forms of the sketch with smooth rounded matte ceramic surfaces, translucent tinted acrylic glass, miniature trees and geometric greenery, subtle warm LED accent strips, and clean studio softbox lighting on a clean minimalist diorama base. Tilt-shift depth of field, ambient occlusion, ultra-clean tactile 3D design. No text, no letters, no logos, no watermarks.',
    negativePrompt:
      '2d flat sketch, messy lines, grunge, dirty, noisy, photorealistic human, dark horror, blurry, text, watermark, logo, signature, UI elements.',
    recommendedControlWeight: 0.85,
    recommendedDenoising: 0.75,
  },
];

export function getRenderTheme(id: RenderThemeId): RenderThemePreset {
  return RENDER_THEMES.find((t) => t.id === id) || RENDER_THEMES[0];
}

export function buildEffectivePrompts(
  basePrompt: string,
  baseNegative: string,
  includePerson: boolean
): { prompt: string; negativePrompt: string } {
  if (!includePerson) {
    return { prompt: basePrompt, negativePrompt: baseNegative };
  }

  const personPrefix =
    'Using the provided camera + neon air-drawing image: keep the real person in the scene naturally (preserve their face, pose, and clothing) while completely transforming the glowing hand-drawn sketch lines into a solid, photorealistic/stylized 3D object/architecture integrated right into the scene with matching lighting and environment. Do NOT leave the drawing as flat glowing neon lines—turn the drawn shapes into real physical materials. Style instructions: ';
  const cleanedNegative = baseNegative
    .replace(/,?\s*human face/gi, '')
    .replace(/,?\s*indoor room/gi, '')
    .replace(/^,\s*/, '');

  return {
    prompt: `${personPrefix}${basePrompt}`,
    negativePrompt: cleanedNegative,
  };
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  provider: 'gemini',
  themeId: 'photorealistic',
  includePerson: true,
  drawTriggerMode: 'touch_hold',
  minMoveThreshold: 1.5,
  smoothingAlpha: 0.55,
  apiKey: '',
  comfyUrl: 'http://127.0.0.1:8188',
  prompt: MASTER_PROMPT,
  negativePrompt: NEGATIVE_PROMPT,
  preprocessor: 'invert',
  controlWeight: 0.8,
  denoisingStrength: 0.72,
};
