import type { RGB, Star } from './starfield';

/** Stars smaller than this are plain dots; larger ones get a soft halo sprite. */
const SPRITE_MIN_RADIUS = 0.9;
/** Halo radius as a multiple of the star's core radius. */
const HALO_SCALE = 6;
const SPRITE_PX = 64;

export function makeStarSprites(colors: readonly RGB[]): HTMLCanvasElement[] {
  return colors.map(makeSprite);
}

function makeSprite([r, g, b]: RGB): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE_PX;
  const ctx = canvas.getContext('2d')!;
  const c = SPRITE_PX / 2;
  const core = 1 / HALO_SCALE;
  const tint = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(core * 0.55, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(core, tint(0.8));
  gradient.addColorStop(core * 1.8, tint(0.22));
  gradient.addColorStop(0.45, tint(0.06));
  gradient.addColorStop(1, tint(0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  return canvas;
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  star: Star,
  sprites: readonly HTMLCanvasElement[],
  alphaScale = 1,
  sizeScale = 1,
) {
  const radius = star.radius * sizeScale;
  ctx.globalAlpha = star.alpha * alphaScale;
  if (radius < SPRITE_MIN_RADIUS) {
    ctx.fillStyle = star.fill;
    ctx.beginPath();
    ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const halo = radius * HALO_SCALE;
  ctx.drawImage(sprites[star.tint], star.x - halo, star.y - halo, halo * 2, halo * 2);
}
