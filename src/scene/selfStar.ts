import { mulberry32 } from '../sky/random';

export interface Ignition {
  /** Core size, 0 → 1 with a slight overshoot. */
  grow: number;
  /** Brief burst of extra light as the star catches. */
  flash: number;
  /** Progress of the shockwave ring, 0 → 1; gone at 1. */
  ring: number;
}

/** A star that has finished igniting. */
export const SETTLED: Ignition = { grow: 1, flash: 0, ring: 1 };

/** Lets the previous screen's exit finish before the star appears. */
const IGNITE_DELAY_S = 0.35;

export function ignition(elapsed: number): Ignition {
  const t = elapsed - IGNITE_DELAY_S;
  if (t <= 0) return { grow: 0, flash: 0, ring: 0 };
  return {
    grow: easeOutBack(clamp01(t / 1.3)),
    flash: Math.exp(-(((t - 0.5) / 0.32) ** 2)),
    ring: clamp01((t - 0.3) / 1.9),
  };
}

const RAY_COUNT = 40;
const RAYS = (() => {
  const rand = mulberry32(42);
  return Array.from({ length: RAY_COUNT }, (_, k) => ({
    angle: ((k + rand() * 0.8) / RAY_COUNT) * Math.PI * 2,
    reach: 0.6 + rand() * 0.8,
    speed: 0.4 + rand() * 1.2,
    phase: rand() * Math.PI * 2,
  }));
})();

/** Fixed tilt so the light spikes don't read as a plus sign. */
const SPIKE_TILT = 0.12;
const BREATH_PERIOD_S = 6;

/** Paints the person's star: halo, glow, corona, light spikes and core, with additive blending. */
export function drawSelfStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seconds: number,
  ig: Ignition,
) {
  if (ig.grow <= 0) return;
  const breath = Math.sin((seconds * Math.PI * 2) / BREATH_PERIOD_S);
  const shimmer = 0.5 + 0.5 * Math.sin(seconds * 2.3 + 1.1) * Math.sin(seconds * 0.7);
  const size = radius * ig.grow * (1 + 0.035 * breath);
  const glow = Math.min(1, ig.grow) * (0.92 + 0.08 * breath) + ig.flash * 0.9;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  glowDisc(ctx, x, y, radius * 26 * (1 + ig.flash * 0.35), [
    [0, `rgba(255, 196, 128, ${0.14 * glow})`],
    [0.22, `rgba(255, 176, 104, ${0.05 * glow})`],
    [1, 'rgba(255, 160, 90, 0)'],
  ]);
  glowDisc(ctx, x, y, size * 7, [
    [0, `rgba(255, 238, 206, ${0.7 * glow})`],
    [0.22, `rgba(255, 206, 142, ${0.26 * glow})`],
    [1, 'rgba(255, 190, 120, 0)'],
  ]);

  drawCorona(ctx, x, y, size, seconds, glow);

  const spike = size * (0.92 + 0.16 * shimmer);
  drawSpikes(ctx, x, y, spike * 11, size * 0.28, SPIKE_TILT, 0.45 * glow);
  drawSpikes(ctx, x, y, spike * 5, size * 0.2, SPIKE_TILT + Math.PI / 4, 0.2 * glow);

  glowDisc(ctx, x, y, size * 1.15, [
    [0, 'rgba(255, 255, 255, 1)'],
    [0.42, 'rgba(255, 252, 244, 1)'],
    [0.68, 'rgba(255, 232, 192, 0.8)'],
    [1, 'rgba(255, 212, 158, 0)'],
  ]);

  if (ig.ring > 0 && ig.ring < 1) drawShockwave(ctx, x, y, radius, ig.ring);
  ctx.restore();
}

function drawCorona(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  seconds: number,
  glow: number,
) {
  const inner = size * 0.9;
  const gradient = ctx.createRadialGradient(x, y, inner, x, y, size * 5.5);
  gradient.addColorStop(0, 'rgba(255, 230, 190, 0.55)');
  gradient.addColorStop(1, 'rgba(255, 200, 140, 0)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(0.6, size * 0.08);
  ctx.lineCap = 'round';

  const drift = seconds * 0.02;
  for (const ray of RAYS) {
    const flicker = 0.5 + 0.5 * Math.sin(seconds * ray.speed + ray.phase);
    const length = size * (1.4 + 3 * ray.reach * flicker);
    const cos = Math.cos(ray.angle + drift);
    const sin = Math.sin(ray.angle + drift);
    ctx.globalAlpha = Math.min(1, glow) * (0.25 + 0.5 * flicker);
    ctx.beginPath();
    ctx.moveTo(x + cos * inner, y + sin * inner);
    ctx.lineTo(x + cos * (inner + length), y + sin * (inner + length));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Four tapered light spikes, like a lens catches on a bright star. */
export function drawSpikes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  alpha: number,
  rgb = '255, 220, 170',
) {
  for (let k = 0; k < 4; k++) {
    const a = angle + (k * Math.PI) / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const gradient = ctx.createLinearGradient(x, y, x + cos * length, y + sin * length);
    gradient.addColorStop(0, `rgba(255, 244, 222, ${alpha})`);
    gradient.addColorStop(0.3, `rgba(${rgb}, ${alpha * 0.35})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - sin * width, y + cos * width);
    ctx.lineTo(x + cos * length, y + sin * length);
    ctx.lineTo(x + sin * width, y - cos * width);
    ctx.closePath();
    ctx.fill();
  }
}

/** A soft wavefront of light rolling outward from the newly lit star. */
function drawShockwave(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, progress: number) {
  const eased = 1 - (1 - progress) ** 3;
  const reach = radius * (3 + 40 * eased);
  const thickness = reach * (0.35 - 0.2 * eased);
  const fade = (1 - progress) ** 2;
  const front = ctx.createRadialGradient(x, y, Math.max(0, reach - thickness), x, y, reach);
  front.addColorStop(0, 'rgba(255, 200, 140, 0)');
  front.addColorStop(0.75, `rgba(255, 222, 182, ${0.16 * fade})`);
  front.addColorStop(1, 'rgba(255, 236, 210, 0)');
  ctx.fillStyle = front;
  ctx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
}

export function glowDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: readonly [number, string][],
) {
  if (radius <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function easeOutBack(t: number): number {
  const overshoot = 1.6;
  const u = t - 1;
  return 1 + (overshoot + 1) * u ** 3 + overshoot * u ** 2;
}
