import { createNoise2D, fbm, mulberry32 } from './random';
import type { Band } from './starfield';

export function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#02030a');
  sky.addColorStop(0.55, '#060a1b');
  sky.addColorStop(1, '#0c1530');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Faint airglow lifting off the horizon.
  const airglow = ctx.createLinearGradient(0, height * 0.65, 0, height);
  airglow.addColorStop(0, 'rgba(30, 62, 84, 0)');
  airglow.addColorStop(1, 'rgba(38, 72, 96, 0.22)');
  ctx.fillStyle = airglow;
  ctx.fillRect(0, 0, width, height);
}

/** Brightest added light (0–255) at the densest part of the band. */
const MILKY_WAY_LEVEL = 52;
/** The haze is computed at reduced resolution; it is soft enough that upscaling hides it. */
const MILKY_WAY_SCALE = 0.25;

export function paintMilkyWay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  band: Band,
  seed: number,
) {
  const w = Math.ceil(width * MILKY_WAY_SCALE);
  const h = Math.ceil(height * MILKY_WAY_SCALE);
  const haze = document.createElement('canvas');
  haze.width = w;
  haze.height = h;
  const hazeCtx = haze.getContext('2d')!;
  const image = hazeCtx.createImageData(w, h);
  const data = image.data;

  const clouds = createNoise2D(seed);
  const dust = createNoise2D(seed + 1);
  const ux = Math.cos(band.angle);
  const uy = Math.sin(band.angle);
  const k = 1 / band.width;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = (px + 0.5) / MILKY_WAY_SCALE;
      const y = (py + 0.5) / MILKY_WAY_SCALE;
      const dx = x - band.cx;
      const dy = y - band.cy;
      const along = (dx * ux + dy * uy) * k;
      const across = (-dx * uy + dy * ux) * k;

      // Wobble the band's centerline so it isn't a ruler-straight stripe.
      const d = across + (fbm(clouds, along * 0.35, 3.1, 3) - 0.5) * 1.6;
      const falloff = Math.exp(-d * d * 0.55);
      if (falloff < 0.004) continue;

      const cloud = fbm(clouds, x * k * 1.3, y * k * 1.3, 5);
      const lanes = fbm(dust, along * 0.9, across * 2.6, 4);
      const laneMask = smoothstep(0.48, 0.68, lanes) * Math.exp(-d * d * 2.2);
      const surge = 0.55 + 0.9 * fbm(clouds, along * 0.25 + 40, 7.7, 3);
      const glow = falloff * (0.18 + 1.3 * cloud * cloud * cloud) * surge * (1 - 0.85 * laneMask);

      // Warm, dense core fading to cool blue edges.
      const warmth = Math.exp(-d * d * 1.6);
      const level = glow * MILKY_WAY_LEVEL;
      const i = (py * w + px) * 4;
      data[i] = level * (0.62 + 0.38 * warmth);
      data[i + 1] = level * (0.68 + 0.2 * warmth);
      data[i + 2] = level * (1 - 0.22 * warmth);
      data[i + 3] = 255;
    }
  }
  hazeCtx.putImageData(image, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(haze, 0, 0, width, height);
  ctx.restore();
}

export function paintVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vignette = ctx.createRadialGradient(
    width / 2,
    height * 0.45,
    Math.min(width, height) * 0.3,
    width / 2,
    height * 0.45,
    Math.hypot(width, height) * 0.62,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

const GRAIN_PX = 128;

/** Fine noise dithers the dark gradients so they never show banding. Paints in device pixels. */
export function paintGrain(ctx: CanvasRenderingContext2D, seed: number) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = GRAIN_PX;
  const tileCtx = tile.getContext('2d')!;
  const image = tileCtx.createImageData(GRAIN_PX, GRAIN_PX);
  const rand = mulberry32(seed);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = rand() * 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 7;
  }
  tileCtx.putImageData(image, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
