/** How each kind of moment changes the sky while it plays, as pure functions of age. */
import type { Moment } from '../model';
import { MOMENT_YEARS, SPARK_YEARS } from './momentSky';
import { clamp01, type Point } from './orbits';
import { glowDisc } from './selfStar';

/** How much closer the people orbiting you come during a hard time, as a share of their lane. */
export const HARDSHIP_PULL = 0.3;

/** A milestone's flare: a burst of extra light and a wave rolling out from your star. */
export interface Flare {
  flash: number;
  /** Progress of the wave, 0 → 1. */
  ring: number;
}

/** The strongest milestone flare at `age`, or null when none is playing. */
export function flareAt(moments: readonly Moment[], age: number): Flare | null {
  let strongest: Flare | null = null;
  for (const moment of moments) {
    if (moment.kind !== 'milestone') continue;
    const t = age - moment.age;
    if (t < 0 || t > MOMENT_YEARS.milestone) continue;
    const flare = { flash: 0.9 * Math.exp(-(((t - 0.12) / 0.14) ** 2)), ring: clamp01(t / 0.8) };
    if (!strongest || flare.flash > strongest.flash) strongest = flare;
  }
  return strongest;
}

/** Where a milestone's spark is on its way down to the constellation, 0 → 1, or null. */
export function sparkProgress(moment: Moment, age: number): number | null {
  if (moment.kind !== 'milestone') return null;
  const t = (age - moment.age) / SPARK_YEARS;
  return t > 0 && t < 1 ? t : null;
}

/** How deep a hard time is at `age`, 0 → 1: it settles in, holds, and lifts. */
export function hardshipDepth(moments: readonly Moment[], age: number): number {
  let depth = 0;
  for (const moment of moments) {
    if (moment.kind !== 'hardship') continue;
    const t = age - moment.age;
    const end = MOMENT_YEARS.hardship;
    depth = Math.max(depth, smoothstep(0, 0.3, t) * (1 - smoothstep(end - 0.4, end, t)));
  }
  return depth;
}

/** A spark of light carried from your star down to the milestone's place in the constellation. */
export function drawSpark(ctx: CanvasRenderingContext2D, from: Point, to: Point, progress: number) {
  const control = { x: from.x + (to.x - from.x) * 0.35 + 60, y: (from.y + to.y) / 2 };
  const at = (u: number): Point => {
    const s = 1 - u;
    return { x: s * s * from.x + 2 * s * u * control.x + u * u * to.x, y: s * s * from.y + 2 * s * u * control.y + u * u * to.y };
  };
  const u = 1 - (1 - progress) ** 2;
  const head = at(u);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const steps = 18;
  for (let k = 0; k < steps; k++) {
    const a = at(Math.max(0, u - 0.28 * (1 - k / steps)));
    const b = at(Math.max(0, u - 0.28 * (1 - (k + 1) / steps)));
    ctx.strokeStyle = `rgba(255, 232, 196, ${0.7 * ((k + 1) / steps) ** 2})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  glowDisc(ctx, head.x, head.y, 12, [
    [0, 'rgba(255, 240, 215, 0.8)'],
    [0.3, 'rgba(255, 220, 170, 0.25)'],
    [1, 'rgba(255, 210, 160, 0)'],
  ]);
  ctx.restore();
}

/** A shadow passing over your star in a hard time: it erases part of the star's light. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number) {
  if (depth <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const r = radius * 1.35;
  const shadow = ctx.createRadialGradient(x + radius * 0.55, y - radius * 0.2, r * 0.6, x + radius * 0.55, y - radius * 0.2, r);
  shadow.addColorStop(0, `rgba(0, 0, 0, ${0.88 * depth})`);
  shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
  ctx.restore();
}

/** How far, and which way, a move turns the sky: its own amount, steady for that moment. */
function turnOf(moment: Moment): number {
  let hash = 2166136261;
  for (let i = 0; i < moment.id.length; i++) hash = Math.imul(hash ^ moment.id.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) >>> 0;
  const sign = hash & 1 ? 1 : -1;
  return sign * (0.45 + 0.3 * ((hash >>> 1) / 0x80000000));
}

/** How far the sky has turned around you by `age`: each move turns it gently over two years. */
export function skyAngle(moments: readonly Moment[], age: number): number {
  let angle = 0;
  for (const moment of moments) {
    if (moment.kind !== 'home') continue;
    const t = clamp01((age - moment.age) / MOMENT_YEARS.home);
    angle += turnOf(moment) * t * t * (3 - 2 * t);
  }
  return angle;
}

/** How strongly an aurora of love fills the sky at `age`, 0 → 1. */
export function auroraStrength(moments: readonly Moment[], age: number): number {
  let strength = 0;
  for (const moment of moments) {
    if (moment.kind !== 'love') continue;
    const t = age - moment.age;
    strength = Math.max(strength, smoothstep(0, 0.4, t) * (1 - smoothstep(1.5, MOMENT_YEARS.love, t)));
  }
  return strength;
}

/** The faint warm glow each love leaves along the horizon once its aurora has faded. */
export function loveGlow(moments: readonly Moment[], age: number): number {
  let glow = 0;
  for (const moment of moments) {
    if (moment.kind === 'love') glow += 0.5 * smoothstep(1.2, MOMENT_YEARS.love, age - moment.age);
  }
  return Math.min(1, glow);
}

/** The aurora is painted small and scaled up, which softens it the way real aurora light diffuses. */
const AURORA_SCALE = 1 / 6;
/** The aurora fills the upper part of the sky, down to this fraction of the height. */
const AURORA_DEPTH = 0.62;
let auroraCanvas: HTMLCanvasElement | null = null;

/**
 * Curtains of aurora across the upper sky: a brighter green foot fading through teal to violet
 * above, swaying slowly and rippling along their length like the real thing.
 */
export function drawAurora(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number, seconds: number) {
  if (strength <= 0.01) return;
  auroraCanvas ??= document.createElement('canvas');
  const w = Math.max(1, Math.ceil(width * AURORA_SCALE));
  const h = Math.max(1, Math.ceil(height * AURORA_DEPTH * AURORA_SCALE));
  if (auroraCanvas.width !== w || auroraCanvas.height !== h) {
    auroraCanvas.width = w;
    auroraCanvas.height = h;
  }
  const small = auroraCanvas.getContext('2d')!;
  small.clearRect(0, 0, w, h);
  small.globalCompositeOperation = 'lighter';
  const sway = seconds * 0.12;
  for (let x = 0; x < w; x++) {
    const u = x / w;
    // Heights are in the small canvas's own pixels.
    const foot = h * (0.5 + 0.1 * Math.sin(u * 8.5 + sway) + 0.04 * Math.sin(u * 23 - sway * 1.7));
    const tall = h * (0.26 + 0.15 * Math.sin(u * 5.2 + 2 + sway * 0.6) ** 2);
    // Fine vertical rays, drifting along the curtain.
    const rays = 0.6 + 0.4 * Math.sin(u * 61 + seconds * 0.7) * Math.sin(u * 17 - seconds * 0.3);
    const edge = Math.sin(Math.PI * u) ** 0.7;
    const a = strength * edge * rays;
    const gradient = small.createLinearGradient(0, foot + h * 0.06, 0, foot - tall);
    gradient.addColorStop(0, 'rgba(80, 255, 170, 0)');
    gradient.addColorStop(0.1, `rgba(90, 255, 175, ${0.3 * a})`);
    gradient.addColorStop(0.3, `rgba(90, 235, 180, ${0.17 * a})`);
    gradient.addColorStop(0.65, `rgba(120, 190, 200, ${0.07 * a})`);
    gradient.addColorStop(0.88, `rgba(170, 110, 255, ${0.05 * a})`);
    gradient.addColorStop(1, 'rgba(170, 110, 255, 0)');
    small.fillStyle = gradient;
    small.fillRect(x, foot - tall, 1, tall + h * 0.06);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(auroraCanvas, 0, 0, width, height * AURORA_DEPTH);
  ctx.restore();
}

/** A soft warm light along the bottom of the sky, as after an aurora of love. */
export function drawLoveGlow(ctx: CanvasRenderingContext2D, width: number, height: number, glow: number) {
  if (glow <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gradient = ctx.createLinearGradient(0, height, 0, height * 0.72);
  gradient.addColorStop(0, `rgba(255, 150, 170, ${0.07 * glow})`);
  gradient.addColorStop(1, 'rgba(255, 150, 170, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  ctx.restore();
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
